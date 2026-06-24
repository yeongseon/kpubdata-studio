/**
 * 빌드 결과 아티팩트/manifest 조회 API 진입점.
 *
 * mock 모드에서는 결정적 mock manifest를 반환해 뷰어 UI를 개발/검증할 수 있게 한다.
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)에서는 Builder `GET /artifacts/{run_id}`를
 * 호출하고, 실제 와이어 형태 `{files, run_id}`를 페이지가 렌더링하는 `BuildManifest`로
 * 매핑한다. /artifacts가 제공하지 않는 필드(recordCount/sources 등)는 안전한 기본값으로
 * 채워 페이지가 누락 필드로 깨지지 않게 한다(#75).
 */
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
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
 * Builder의 실제 `/artifacts` 응답({files, run_id})을 페이지가 쓰는 BuildManifest로
 * 매핑한다. /artifacts가 제공하지 않는 메타 필드는 안전한 기본값으로 채운다.
 *
 * @param runId - 빌드 실행 ID.
 * @param files - Builder가 반환한 산출물 파일 경로 목록.
 * @returns BuildManifest(메타 필드는 기본값).
 */
function artifactsToManifest(runId: string, files: string[]): BuildManifest {
  return {
    buildId: runId,
    startedAt: "",
    finishedAt: "",
    sources: [],
    artifactPaths: files,
    recordCount: 0,
    warnings: [],
    errors: [],
  };
}

/**
 * 특정 빌드 실행의 manifest 정보를 조회한다.
 *
 * 실연동 모드면 Builder `/artifacts/{run_id}`의 파일 목록을 BuildManifest로 매핑하고,
 * 아니면 결정적 mock manifest를 반환한다.
 *
 * @param buildId - 조회 대상 빌드 실행 ID.
 * @param signal - 취소용 AbortSignal(선택).
 * @returns 빌드 manifest 정보.
 */
export async function getBuildManifest(
  buildId: string,
  signal?: AbortSignal,
): Promise<BuildManifest> {
  if (!isRealBuilderEnabled()) {
    return mockManifest(buildId);
  }

  const result = await builderApi.artifacts(buildId, signal);
  return artifactsToManifest(result.run_id, result.files);
}
