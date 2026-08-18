import type {
  BuildQualityResponse,
  DatasetDetailResponse,
  DatasetQualityHistoryResponse,
  DatasetRunsResponse,
  DatasetsResponse,
  RunStagesResponse,
  StageDetailResponse,
} from "@/shared/lib/builderApi";

export const MOCK_DATASETS: DatasetsResponse = {
  datasets: [
    {
      dataset_id: "air-quality",
      title: "대기질 통합 데이터",
      sources: [
        { provider: "data.go.kr", dataset: "air", alias: "서울 대기질" },
        { provider: "kma", dataset: "weather", alias: "기상 관측" },
      ],
      latest_run_id: "air-2026-08-14",
      status: "failed",
      updated_at: "2026-08-14T07:30:00Z",
      row_counts: { datago__air: 1000, kma__weather: 200 },
      total_row_count: 1200,
      stages: {
        datago__air: { bronze: "completed", silver: "completed", gold: "completed" },
        kma__weather: { bronze: "completed", silver: "failed", gold: "not_run" },
      },
      quality: null,
    },
    {
      dataset_id: "population",
      title: "행정구역별 인구",
      sources: [{ provider: "kosis", dataset: "population", alias: "주민등록 인구" }],
      latest_run_id: "population-2026-08-13",
      status: "ok",
      updated_at: "2026-08-13T09:00:00Z",
      row_counts: { kosis__population: 229 },
      total_row_count: 229,
      stages: {
        kosis__population: { bronze: "completed", silver: "completed", gold: "unavailable" },
      },
      quality: null,
    },
    {
      dataset_id: "transport",
      title: "대중교통 운행 현황",
      sources: [{ provider: "seoul", dataset: "transport", alias: "서울 교통" }],
      latest_run_id: "transport-2026-08-12",
      status: "ok",
      updated_at: "2026-08-12T04:10:00Z",
      row_counts: { seoul__transport: 540 },
      total_row_count: 540,
      stages: {
        seoul__transport: { bronze: "completed", silver: "completed", gold: "completed" },
      },
      quality: null,
    },
  ],
};

export const MOCK_RUNS: Record<string, DatasetRunsResponse> = {
  "air-quality": {
    dataset_id: "air-quality",
    runs: [
      { run_id: "air-2026-08-14", status: "failed", started_at: "2026-08-14T07:00:00Z", finished_at: "2026-08-14T07:30:00Z", spec_digest: "sha256:air14", created_by: "user@example.com" },
      { run_id: "air-2026-08-13", status: "ok", started_at: "2026-08-13T07:00:00Z", finished_at: "2026-08-13T07:20:00Z", spec_digest: "sha256:air13", created_by: "user@example.com" },
    ],
  },
  population: {
    dataset_id: "population",
    runs: [{ run_id: "population-2026-08-13", status: "ok", started_at: "2026-08-13T08:45:00Z", finished_at: "2026-08-13T09:00:00Z", spec_digest: null, created_by: null }],
  },
  transport: {
    dataset_id: "transport",
    runs: [{ run_id: "transport-2026-08-12", status: "ok", started_at: "2026-08-12T04:00:00Z", finished_at: "2026-08-12T04:10:00Z", spec_digest: null, created_by: null }],
  },
};

export const MOCK_STAGES: Record<string, RunStagesResponse> = {
  // Builds/Runs 목록(mockBuilds → DEMO_DATASETS.buildId)이 실제로 쓰는 run id로도
  // stage/quality fixture를 조회할 수 있도록 정합시킨다(#255 마감 보완). 새 mock
  // 의미를 만들지 않고, 아래 air-2026-08-* fixture와 같은 모양을 그대로 재사용한다.
  "air-quality-20260621": {
    run_id: "air-quality-20260621",
    sources: [
      { source_key: "datago__air_quality", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "completed", available: true } },
    ],
  },
  "dur-older-adult-caution-20260618": {
    run_id: "dur-older-adult-caution-20260618",
    sources: [
      { source_key: "datago__dur_older_adult_caution", bronze: { status: "failed", available: false }, silver: { status: "not_run", available: false }, gold: { status: "not_run", available: false } },
    ],
  },
  "air-2026-08-14": {
    run_id: "air-2026-08-14",
    sources: [
      { source_key: "datago__air", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "completed", available: true } },
      { source_key: "kma__weather", bronze: { status: "completed", available: true }, silver: { status: "failed", available: false }, gold: { status: "not_run", available: false } },
    ],
  },
  "air-2026-08-13": {
    run_id: "air-2026-08-13",
    sources: [
      { source_key: "datago__air", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "completed", available: true } },
      { source_key: "kma__weather", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "completed", available: true } },
    ],
  },
  "population-2026-08-13": {
    run_id: "population-2026-08-13",
    sources: [{ source_key: "kosis__population", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "unavailable", available: false } }],
  },
  "transport-2026-08-12": {
    run_id: "transport-2026-08-12",
    sources: [{ source_key: "seoul__transport", bronze: { status: "completed", available: true }, silver: { status: "completed", available: true }, gold: { status: "completed", available: true } }],
  },
};

export const MOCK_QUALITY: Record<string, BuildQualityResponse> = {
  // MOCK_STAGES와 같은 run id 정합 보완(#255) — mockBuilds()가 실제로 노출하는
  // succeeded/failed run 각 하나에 실제 Quality 결과를 붙인다.
  "air-quality-20260621": {
    run_id: "air-quality-20260621",
    availability: "available",
    evaluated_checks: 1,
    quality_results: {
      datago__air_quality: [
        { source_key: "datago__air_quality", category: "row_count", rule: "min_rows", column: null, status: "pass", actual: 12304, threshold: 100, affected_rows: null, evaluated_rows: 12304, detail: null },
      ],
    },
    schema_drift: { datago__air_quality: [] },
  },
  // bronze 단계에서 실패한 run이라 quality가 계산되지 않았다(N/A ≠ PASS) —
  // MOCK_STAGES의 bronze failed와 정합되는, 지어내지 않은 값.
  "dur-older-adult-caution-20260618": {
    run_id: "dur-older-adult-caution-20260618",
    availability: "unavailable",
    evaluated_checks: 0,
    quality_results: {},
    schema_drift: {},
  },
  "air-2026-08-14": {
    run_id: "air-2026-08-14",
    availability: "partial",
    evaluated_checks: 2,
    quality_results: {
      datago__air: [{ source_key: "datago__air", category: "missing", rule: "max_null_ratio", column: "pm10", status: "pass", actual: 0.01, threshold: 0.05, affected_rows: 10, evaluated_rows: 1000, detail: null }],
      kma__weather: [{ source_key: "kma__weather", category: "schema", rule: "required_column", column: "temperature", status: "fail", actual: false, threshold: true, affected_rows: null, evaluated_rows: null, detail: "필수 컬럼이 없습니다." }],
    },
    schema_drift: { datago__air: [], kma__weather: [{ kind: "column_removed", column: "temperature", detail: "temperature 컬럼이 제거되었습니다." }] },
  },
  "air-2026-08-13": {
    run_id: "air-2026-08-13",
    availability: "available",
    evaluated_checks: 2,
    quality_results: {
      datago__air: [{ source_key: "datago__air", category: "row_count", rule: "min_rows", column: null, status: "pass", actual: 1000, threshold: 100, affected_rows: null, evaluated_rows: 1000, detail: null }],
      kma__weather: [{ source_key: "kma__weather", category: "missing", rule: "max_null_ratio", column: "humidity", status: "warn", actual: 0.08, threshold: 0.05, affected_rows: 16, evaluated_rows: 200, detail: null }],
    },
    schema_drift: { datago__air: [], kma__weather: [] },
  },
  "population-2026-08-13": { run_id: "population-2026-08-13", availability: "unavailable", evaluated_checks: 0, quality_results: {}, schema_drift: {} },
  "transport-2026-08-12": {
    run_id: "transport-2026-08-12",
    availability: "available",
    evaluated_checks: 1,
    quality_results: { seoul__transport: [{ source_key: "seoul__transport", category: "duplicate", rule: "max_duplicate_rate", column: null, status: "pass", actual: 0, threshold: 0.01, affected_rows: 0, evaluated_rows: 540, detail: null }] },
    schema_drift: { seoul__transport: [] },
  },
};

export const MOCK_QUALITY_HISTORY: Record<string, DatasetQualityHistoryResponse> = {
  "air-quality": { dataset_id: "air-quality", runs: [
    { run_id: "air-2026-08-14", timestamp: "2026-08-14T07:30:00Z", status: "failed", pass_count: 1, warn_count: 0, fail_count: 1, evaluated_checks: 2, rule_pass_rate: 0.5, validated_rows: 1200 },
    { run_id: "air-2026-08-13", timestamp: "2026-08-13T07:20:00Z", status: "ok", pass_count: 1, warn_count: 1, fail_count: 0, evaluated_checks: 2, rule_pass_rate: 0.5, validated_rows: 1200 },
  ] },
  population: { dataset_id: "population", runs: [{ run_id: "population-2026-08-13", timestamp: "2026-08-13T09:00:00Z", status: "ok", pass_count: 0, warn_count: 0, fail_count: 0, evaluated_checks: 0, rule_pass_rate: null, validated_rows: 229 }] },
  transport: { dataset_id: "transport", runs: [{ run_id: "transport-2026-08-12", timestamp: "2026-08-12T04:10:00Z", status: "ok", pass_count: 1, warn_count: 0, fail_count: 0, evaluated_checks: 1, rule_pass_rate: 1, validated_rows: 540 }] },
};

export function mockDatasetDetail(datasetId: string): DatasetDetailResponse | undefined {
  const dataset = MOCK_DATASETS.datasets.find((item) => item.dataset_id === datasetId);
  return dataset ? { ...dataset, run_count: MOCK_RUNS[datasetId]?.runs.length ?? 0 } : undefined;
}

export function mockStageDetail(runId: string, sourceKey: string, stage: "bronze" | "silver" | "gold"): StageDetailResponse | undefined {
  const source = MOCK_STAGES[runId]?.sources.find((item) => item.source_key === sourceKey);
  if (!source) return undefined;
  const state = source[stage];
  if (stage === "bronze") return { run_id: runId, stage, source_key: sourceKey, ...state, provider: sourceKey.split("__")[0] ?? null, dataset: sourceKey.split("__")[1] ?? null, fetched_at: state.available ? "2026-08-14T07:05:00Z" : null, record_count: state.available ? 1200 : null };
  if (stage === "silver") return { run_id: runId, stage, source_key: sourceKey, ...state, row_count: state.available ? 1200 : null, schema: state.available ? [{ name: "observed_at", dtype: "datetime", nullable: false, unique_count: 1200 }, { name: "value", dtype: "float64", nullable: true, unique_count: 480 }] : [], statistics: state.available ? { row_count: 1200, null_counts: { observed_at: 0, value: 4 }, duplicate_rate: 0 } : null, validation: state.available ? { ok: true, problems: [] } : null, sample: state.available ? [{ observed_at: "2026-08-14T00:00:00Z", value: 24.2 }, { observed_at: "2026-08-14T01:00:00Z", value: 23.8 }] : [] };
  return { run_id: runId, stage, source_key: sourceKey, ...state, row_count: state.available ? 1200 : null, columns: state.available ? ["observed_at", "value"] : [], splits: null, exports: state.available ? [{ kind: "parquet" }] : [], sample: null, sample_available: false };
}
