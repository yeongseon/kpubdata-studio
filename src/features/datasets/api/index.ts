import {
  ApiError,
  builderApi,
  isRealBuilderEnabled,
  type BuildQualityResponse,
  type DatasetDetailResponse,
  type DatasetQualityHistoryResponse,
  type DatasetRunsResponse,
  type DatasetSummary,
  type RunStagesResponse,
  type StageDetailResponse,
} from "@/shared/lib/builderApi";
import { summarizeQuality, type ValidationStatus } from "@/features/quality/model";
import {
  MOCK_DATASETS,
  MOCK_QUALITY,
  MOCK_QUALITY_HISTORY,
  MOCK_RUNS,
  MOCK_STAGES,
  mockDatasetDetail,
  mockStageDetail,
} from "./mockData";

export interface CatalogDataset extends DatasetSummary {
  validation: ValidationStatus;
  qualityError?: string;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

export async function listDatasets(limit = 50, signal?: AbortSignal): Promise<DatasetSummary[]> {
  if (isRealBuilderEnabled()) return (await builderApi.listDatasets(limit, signal)).datasets;
  throwIfAborted(signal);
  return MOCK_DATASETS.datasets.slice(0, limit);
}

export async function getDataset(datasetId: string, signal?: AbortSignal): Promise<DatasetDetailResponse> {
  if (isRealBuilderEnabled()) return builderApi.getDataset(datasetId, signal);
  throwIfAborted(signal);
  const dataset = mockDatasetDetail(datasetId);
  if (!dataset) throw new ApiError(404, "요청한 데이터셋을 찾을 수 없습니다.");
  return dataset;
}

export async function listDatasetRuns(datasetId: string, limit = 50, signal?: AbortSignal): Promise<DatasetRunsResponse> {
  if (isRealBuilderEnabled()) return builderApi.listDatasetRuns(datasetId, limit, signal);
  throwIfAborted(signal);
  const runs = MOCK_RUNS[datasetId];
  if (!runs) throw new ApiError(404, "요청한 데이터셋의 실행 이력을 찾을 수 없습니다.");
  return { ...runs, runs: runs.runs.slice(0, limit) };
}

export async function listBuildStages(runId: string, signal?: AbortSignal): Promise<RunStagesResponse> {
  if (isRealBuilderEnabled()) return builderApi.listBuildStages(runId, signal);
  throwIfAborted(signal);
  const stages = MOCK_STAGES[runId];
  if (!stages) throw new ApiError(404, "요청한 실행의 stage 정보를 찾을 수 없습니다.");
  return stages;
}

export async function getBuildStageDetail(
  runId: string,
  stage: StageDetailResponse["stage"],
  source: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<StageDetailResponse> {
  if (isRealBuilderEnabled()) return builderApi.getBuildStageDetail(runId, stage, source, limit, signal);
  throwIfAborted(signal);
  const detail = mockStageDetail(runId, source, stage);
  if (!detail) throw new ApiError(404, "요청한 source 또는 stage를 찾을 수 없습니다.");
  return detail.stage === "silver" ? { ...detail, sample: detail.sample.slice(0, limit) } : detail;
}

export async function getBuildQuality(runId: string, signal?: AbortSignal): Promise<BuildQualityResponse> {
  if (isRealBuilderEnabled()) return builderApi.getBuildQuality(runId, signal);
  throwIfAborted(signal);
  const quality = MOCK_QUALITY[runId];
  if (!quality) throw new ApiError(404, "요청한 실행의 quality 결과를 찾을 수 없습니다.");
  return quality;
}

export async function getDatasetQualityHistory(datasetId: string, limit = 30, signal?: AbortSignal): Promise<DatasetQualityHistoryResponse> {
  if (isRealBuilderEnabled()) return builderApi.getDatasetQualityHistory(datasetId, limit, signal);
  throwIfAborted(signal);
  const history = MOCK_QUALITY_HISTORY[datasetId];
  if (!history) throw new ApiError(404, "요청한 데이터셋의 quality 이력을 찾을 수 없습니다.");
  return { ...history, runs: history.runs.slice(0, limit) };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

/** Dataset별 quality 요청을 최대 4개로 제한하고, 개별 실패를 N/A로 격리한다. */
export async function loadDatasetCatalog(signal?: AbortSignal): Promise<CatalogDataset[]> {
  const datasets = await listDatasets(50, signal);
  return mapWithConcurrency(datasets, 4, async (dataset) => {
    try {
      const quality = await getBuildQuality(dataset.latest_run_id, signal);
      return { ...dataset, validation: summarizeQuality(quality) };
    } catch (cause) {
      if (signal?.aborted) throw cause;
      return {
        ...dataset,
        validation: "N/A",
        qualityError: cause instanceof Error ? cause.message : "Quality 결과를 불러오지 못했습니다.",
      };
    }
  });
}
