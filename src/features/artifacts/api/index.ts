/**
 * 빌드 결과 아티팩트/manifest 조회 API 진입점.
 *
 * 실제 Builder 연동(#29) 전까지는 결정적 mock manifest를 반환해 뷰어 UI를 개발/검증할 수
 * 있게 한다. #29에서 이 함수를 실제 HTTP 호출로 교체한다.
 */
import { API_BASE } from "@/shared/config/env";
import type { BuildManifest } from "@/shared/lib/types";

/**
 * 빌드 ID 기반의 결정적 mock manifest를 만든다(#30, #29 연동 전 임시).
 *
 * @param buildId - 빌드 실행 ID.
 * @returns mock BuildManifest.
 */
function mockManifest(buildId: string): BuildManifest {
  return {
    buildId,
    startedAt: "2026-06-21T00:00:00.000Z",
    finishedAt: "2026-06-21T00:00:08.000Z",
    sources: [{ provider: "datago", dataset: "air-quality", params: { sidoName: "서울" } }],
    artifactPaths: [
      `artifacts/builds/${buildId}/data.jsonl`,
      `artifacts/builds/${buildId}/README.md`,
      `artifacts/builds/${buildId}/manifest.json`,
    ],
    recordCount: 12304,
    warnings: [],
    errors: [],
  };
}

/**
 * 특정 빌드 실행의 manifest 정보를 조회한다.
 *
 * @param buildId - 조회 대상 빌드 실행 ID.
 * @returns 빌드 manifest 정보(현재는 mock).
 */
export async function getBuildManifest(buildId: string): Promise<BuildManifest> {
  void API_BASE;
  return mockManifest(buildId);
}
