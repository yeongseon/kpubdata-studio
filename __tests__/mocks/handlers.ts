/**
 * MSW 요청 핸들러 (#160, #104).
 *
 * Builder API 응답을 모킹해 E2E 테스트에서 네트워크 없이 검증한다.
 * contract/builder-api.yaml의 SSOT와 정합하도록 작성.
 */
import { http, HttpResponse } from "msw";
import { API_BASE } from "@/shared/config/env";

// builderApi가 실제로 요청을 보내는 base와 동일하게 파생한다(로컬 .env.local의
// VITE_BUILDER_API_URL 유무와 무관하게 핸들러가 매칭되도록). 특정 host 문자열에
// 다시 종속시키지 않는다.
const BASE = API_BASE;

export const handlers = [
  http.get(`${BASE}/healthz`, () =>
    HttpResponse.json({ status: "ok" }),
  ),

  http.get(`${BASE}/version`, () =>
    HttpResponse.json({ service: "kpubdata-builder", api_version: "1.6.0" }),
  ),

  http.post(`${BASE}/validate`, () =>
    HttpResponse.json({
      status: "valid",
      dataset_id: "dataset.sample",
      api_version: "1.6.0",
    }),
  ),

  http.post(`${BASE}/preview`, () =>
    HttpResponse.json({
      dataset_id: "dataset.sample",
      previews: [
        {
          source_key: "sample",
          status: "ok",
          error: null,
          schema: [{ name: "id", dtype: "str", nullable: false, unique_count: 3 }],
          sample: [{ id: "1" }, { id: "2" }, { id: "3" }],
          total_rows: 3,
          statistics: { row_count: 3, null_counts: { id: 0 }, duplicate_rate: 0 },
          quality_results: [],
          source_sample: [{ id: "1" }, { id: "2" }, { id: "3" }],
          sample_mode: "first",
          diff_available: false,
          diffs: [],
          transform_summary: null,
          diff_truncated: false,
        },
      ],
    }),
  ),

  http.post(`${BASE}/build`, () =>
    HttpResponse.json({
      status: "ok",
      run_id: "test-run-001",
      outcomes: [
        { source_key: "sample", status: "ok", stages_completed: ["bronze", "silver", "gold"], error: null },
      ],
      manifest: "/data/test-run-001/manifest.json",
      api_version: "1.6.0",
    }),
  ),

  http.get(`${BASE}/builds`, () =>
    HttpResponse.json({
      builds: [
        { run_id: "test-run-001", status: "ok", started_at: "2025-01-01T00:00:00Z", finished_at: "2025-01-01T00:05:00Z" },
      ],
    }),
  ),

  http.get(`${BASE}/artifacts/:runId`, () =>
    HttpResponse.json({
      run_id: "test-run-001",
      files: ["manifest.json", "sample.parquet"],
    }),
  ),

  http.get(`${BASE}/builds/:runId/publish/readiness`, ({ params }) =>
    HttpResponse.json({
      run_id: String(params.runId),
      target: "huggingface",
      ready: true,
      blockers: [],
      warnings: [],
    }),
  ),

  http.post(`${BASE}/builds/:runId/publish`, async ({ params, request }) => {
    const body = await request.json() as { destination: string };
    return HttpResponse.json({
      run_id: String(params.runId),
      target: "huggingface",
      publisher: "huggingface",
      destination: body.destination,
      reference: `https://huggingface.co/datasets/${body.destination}`,
      artifact_count: 1,
      status: "ok",
    });
  }),
];
