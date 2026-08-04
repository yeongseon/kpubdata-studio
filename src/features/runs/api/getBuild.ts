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
import type { BuildRun } from "@/shared/lib/types";
import { listBuilds } from "./index";

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

  const builds = await listBuilds();
  const build = builds.find((candidate) => candidate.id === buildId);
  const storedSpec = loadBuildSpec(buildId);

  if (build) {
    return storedSpec ? { ...build, spec: storedSpec } : build;
  }

  // 목록에 없으면 실제 실행 이력이 없는 것이다. 스펙만 저장돼 있다고 해서 성공 상태를
  // 지어내면 안 된다(#155).
  if (isRealBuilderEnabled()) {
    // 실연동 모드에서 목록이 비어 있는 원인은 Builder `GET /builds` 미연동이다(#102).
    // 사용자가 "존재하지 않는 빌드"로 오해하지 않도록 원인을 드러낸다.
    throw new Error(
      `빌드를 찾을 수 없습니다: ${buildId}. Builder 이력 목록 연동(#102) 이후 조회할 수 있습니다.`,
    );
  }
  throw new Error(`빌드를 찾을 수 없습니다: ${buildId}`);
}
