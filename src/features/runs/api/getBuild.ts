/**
 * 개별 빌드 실행 정보 조회 API.
 *
 * buildId로 빌드 상세 정보를 가져온다.
 */
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildRun } from "@/shared/lib/types";

/** mock 모드에서 사용할 가짜 빌드 데이터 */
function mockBuild(buildId: string): BuildRun {
  return {
    id: buildId,
    spec: {
      datasetId: "mock-dataset",
      title: "Mock Build",
      description: "Mock build for development",
      sources: [],
      exports: [],
      metadata: {},
    },
    status: "succeeded",
    startedAt: "1970-01-01T00:00:00.000Z",
    finishedAt: "1970-01-01T00:00:01.000Z",
  };
}

/**
 * buildId로 빌드 실행 정보를 조회한다.
 *
 * @param buildId - 조회할 빌드 ID.
 * @returns 빌드 실행 정보.
 */
export async function getBuild(buildId: string): Promise<BuildRun> {
  if (!isRealBuilderEnabled()) {
    return mockBuild(buildId);
  }

  // 실연동 모드에서는 listBuilds() 결과에서 찾는다.
  // Builder에 개별 조회 엔드포인트가 없으므로 전체 목록을 가져와서 필터링한다.
  const { listBuilds } = await import("./index");
  const builds = await listBuilds();
  const build = builds.find((b) => b.id === buildId);

  if (!build) {
    throw new Error(`빌드를 찾을 수 없습니다: ${buildId}`);
  }

  return build;
}
