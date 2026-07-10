/**
 * 빌드 결과 아티팩트/manifest 조회 API 진입점.
 *
 * mock 모드에서는 결정적 mock manifest를 반환해 뷰어 UI를 개발/검증할 수 있게 한다.
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)에서는 Builder `GET /artifacts/{run_id}`를
 * 호출하고, 실제 와이어 형태 `{files, run_id}`를 페이지가 렌더링하는 `BuildManifest`로
 * 매핑한다. /artifacts가 제공하지 않는 필드(recordCount/sources 등)는 안전한 기본값으로
 * 채워 페이지가 누락 필드로 깨지지 않게 한다(#75).
 */
import { findDemoDataset } from "@/shared/lib/demoDatasets";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildManifest } from "@/shared/lib/types";

/**
 * 빌드 ID 기반의 결정적 mock manifest를 만든다(#30, #29 연동 전 임시).
 *
 * @param buildId - 빌드 실행 ID.
 * @returns mock BuildManifest.
 */
function mockManifest(buildId: string): BuildManifest {
  const dataset = findDemoDataset(buildId);
  const sourceKey = `datago.${dataset.slug}`;
  const succeeded = dataset.status === "succeeded";

  return {
    schema_version: "1.0.0",
    build_id: buildId,
    started_at: dataset.startedAt,
    finished_at: dataset.finishedAt ?? "",
    build_environment: {
      python_version: "3.12.3",
      kpubdata_version: "0.4.0",
      builder_version: "0.4.0",
    },
    inputs: [sourceKey],
    inputs_fingerprint: succeeded
      ? `sha256:${dataset.slug.replace(/-/g, "").padEnd(64, "0").slice(0, 64)}`
      : null,
    outputs: succeeded
      ? [
          `artifacts/builds/${buildId}/data/train.parquet`,
          `artifacts/builds/${buildId}/README.md`,
          `artifacts/builds/${buildId}/manifest.json`,
        ]
      : [],
    warnings: [],
    errors: dataset.errors ?? [],
    row_counts: succeeded ? { [sourceKey]: dataset.recordCount } : {},
    schema_summaries: succeeded
      ? {
          [sourceKey]: {
            fields: dataset.fields,
            total_fields: dataset.fields.length,
          },
        }
      : {},
    provenance: succeeded
      ? [
          {
            provider: "datago",
            dataset: dataset.slug,
            fetched_at: dataset.finishedAt ?? dataset.startedAt,
            record_count: dataset.recordCount,
            data_checksum: `sha256:${dataset.slug.replace(/-/g, "").padEnd(64, "1").slice(0, 64)}`,
            api_version: "unknown",
            params: dataset.params,
          },
        ]
      : [],
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
    schema_version: "1.0.0",
    build_id: runId,
    started_at: "",
    finished_at: "",
    build_environment: null,
    inputs: [],
    inputs_fingerprint: null,
    outputs: files,
    warnings: [],
    errors: [],
    row_counts: {},
    schema_summaries: {},
    provenance: [],
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
