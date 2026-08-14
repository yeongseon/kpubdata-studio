/**
 * MSW 요청 핸들러 (#160, #104).
 *
 * Builder API 응답을 모킹해 E2E 테스트에서 네트워크 없이 검증한다.
 * contract/builder-api.yaml의 SSOT와 정합하도록 작성.
 */
import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

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
];
