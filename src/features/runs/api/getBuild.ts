/**
 * 개별 빌드 실행 정보 조회 API (#120).
 *
 * Builder에는 개별 조회 엔드포인트(`GET /builds/{run_id}`)가 없다. 그래서 실행 이력
 * 목록에서 run_id로 찾고, 스펙은 Studio가 실행 시점에 보관해 둔 값(specStore)으로
 * 채운다. Builder가 `GET /builds/{run_id}`와 spec 영속화를 제공하게 되면 이 함수의
 * 내부만 단일 호출로 교체하면 된다.
 */
import { loadBuildSpec } from "@/features/build-spec/specStore";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildListItem, BuildRun } from "@/shared/lib/types";
import { listBuilds, mockBuilds } from "./index";

/**
 * buildId로 빌드 실행 정보를 조회한다.
 *
 * 목록에서 찾은 실행 정보에, 보관된 스펙이 있으면 그것으로 덮어써 반환한다. 보관된
 * 스펙은 실행에 실제로 사용된 값이므로 목록이 들고 있는 요약보다 정확하다.
 *
 * @param buildId - 조회할 빌드 ID(run_id).
 * @returns 빌드 실행 정보.
 * @throws Error 해당 ID의 빌드를 찾지 못한 경우.
 */
export async function getBuild(buildId: string): Promise<BuildRun> {
  if (!buildId) {
    throw new Error("빌드 ID가 없습니다.");
  }

  const storedSpec = loadBuildSpec(buildId);

  // mock 모드: 결정적 mock 이력이 전체 BuildSpec을 들고 있으므로 그대로 활용한다.
  // (실연동용 listBuilds()는 #153 이후 spec 없는 BuildListItem[]만 반환하므로 상세를
  // 구성할 수 없다.)
  if (!isRealBuilderEnabled()) {
    const mockRun = mockBuilds().find((candidate) => candidate.id === buildId);
    if (mockRun) {
      return storedSpec ? { ...mockRun, spec: storedSpec } : mockRun;
    }
    if (storedSpec) {
      return { id: buildId, spec: storedSpec, status: "succeeded" as const, startedAt: "" };
    }
    throw new Error(`빌드를 찾을 수 없습니다: ${buildId}`);
  }

  // 실연동 모드: Builder 목록은 spec/title을 제공하지 않으므로(BuildListItem) 상세를
  // 채우려면 Studio가 실행 시점에 보관한 스펙(storedSpec)이 반드시 필요하다.
  const items: BuildListItem[] = await listBuilds();
  const item = items.find((candidate) => candidate.id === buildId);
  if (item && storedSpec) {
    return {
      id: item.id,
      spec: storedSpec,
      status: item.status,
      startedAt: item.startedAt ?? "",
      finishedAt: item.finishedAt ?? undefined,
    };
  }

  // 목록에 없지만 스펙이 보관돼 있는 경우(방금 실행한 빌드). 실행 상태는 알 수 없으므로
  // 지어내지 않는다.
  if (storedSpec) {
    return { id: buildId, spec: storedSpec, status: "succeeded" as const, startedAt: "" };
  }

  // 실연동 모드에서 목록이 비어 있는 원인은 Builder `GET /builds` 미연동이다(#102).
  // 사용자가 "존재하지 않는 빌드"로 오해하지 않도록 원인을 드러낸다.
  throw new Error(
    `빌드를 찾을 수 없습니다: ${buildId}. Builder 이력 목록 연동(#102) 이후 조회할 수 있습니다.`,
  );
}
