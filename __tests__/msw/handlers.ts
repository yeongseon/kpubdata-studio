/**
 * MSW (Mock Service Worker) 핸들러 — Builder API HTTP 모의 응답 (#104)
 *
 * 실제 Builder API와 동일한 와이어 형태로 응답하여,
 * vitest 환경에서 실제 HTTP 요청을 통한 E2E 테스트를 가능하게 한다.
 *
 * 참고: src/shared/lib/builderApi.ts의 응답 타입과 정합하도록 작성할 것.
 */

import { http, HttpResponse } from "msw";

/**
 * Builder API 기본 URL (VITE_USE_REAL_BUILDER=false인 테스트 환경).
 * 실제 fetch 요청은 이 URL로 향하며, MSW가 인터셉트한다.
 */
const API_BASE = "http://localhost:8000";

export const handlers = [
  /**
   * GET /version — Builder API 계약 버전 확인
   */
  http.get(`${API_BASE}/version`, () => {
    return HttpResponse.json({
      service: "kpubdata-builder",
      api_version: "1.0.0",
    });
  }),

  /**
   * POST /validate — BuildSpec YAML 검증 (동기식)
   */
  http.post(`${API_BASE}/validate`, async ({ request }) => {
    const body = await request.json();
    const spec = typeof body === "object" && body && "spec" in body ? (body as { spec: string }).spec : "";

    // 유효한 스펙 예시
    if (spec.includes("dataset_id: weather_report") && spec.includes("region:")) {
      return HttpResponse.json({
        status: "valid" as const,
        dataset_id: "weather_report",
        api_version: "1.0.0",
      });
    }

    // 필수 파라미터 누락 (검증 실패) — sources가 있지만 region이 없는 경우
    if (spec.includes("sources:") && spec.includes("region:") === false) {
      return HttpResponse.json(
        {
          status: "invalid" as const,
          problems: ["'region' 파라미터가 누락되었습니다."],
        },
        { status: 400 },
      );
    }

    // 스펙 로딩 오류
    if (spec.includes("invalid_yaml")) {
      return HttpResponse.json(
        {
          status: "error" as const,
          error: "top-level YAML must be a mapping",
        },
        { status: 400 },
      );
    }

    // 기본 응답
    return HttpResponse.json({
      status: "valid" as const,
      dataset_id: "test_dataset",
      api_version: "1.0.0",
    });
  }),

  /**
   * POST /build — 빌드 파이프라인 실행 (동기식)
   */
  http.post(`${API_BASE}/build`, async ({ request }) => {
    const body = await request.json();
    const spec = typeof body === "object" && body && "spec" in body ? (body as { spec: string }).spec : "";

    // 정상 빌드 응답
    if (spec.includes("dataset_id: success")) {
      return HttpResponse.json({
        status: "ok" as const,
        run_id: "run_123",
        outcomes: [
          {
            source_key: "kma__forecast",
            status: "ok" as const,
            stages_completed: ["bronze", "silver"],
            error: null,
          },
        ],
        manifest: "output/run_123/manifest.json",
        api_version: "1.0.0",
      });
    }

    // 소스 실패 응답 (502)
    if (spec.includes("dataset_id: fail_source")) {
      return HttpResponse.json(
        {
          status: "failed" as const,
          run_id: "run_456",
          outcomes: [
            {
              source_key: "datago__corporation",
              status: "failed" as const,
              stages_completed: [],
              error: "upstream API timeout",
            },
          ],
          manifest: "output/run_456/manifest.json",
          api_version: "1.0.0",
        },
        { status: 502 },
      );
    }

    // 기본 응답
    return HttpResponse.json({
      status: "ok" as const,
      run_id: "run_default",
      outcomes: [],
      manifest: "output/run_default/manifest.json",
      api_version: "1.0.0",
    });
  }),

  /**
   * GET /artifacts/{run_id} — 실행 산출물 파일 목록
   */
  http.get<{ run_id: string }>(`${API_BASE}/artifacts/:run_id`, ({ params }) => {
    const { run_id } = params;
    return HttpResponse.json({
      run_id,
      files: ["manifest.json", "weather_report.md", "weather_report.parquet"],
    });
  }),

  /**
   * POST /preview — 소스 스키마와 샘플 행 산출 (파일 미기록)
   */
  http.post(`${API_BASE}/preview`, async ({ request }) => {
    return HttpResponse.json({
      dataset_id: "weather_report",
      previews: [
        {
          source_key: "kma__forecast",
          status: "ok" as const,
          error: null,
          schema: [
            { name: "date", dtype: "Utf8", nullable: false, unique_count: 30 },
            { name: "temp", dtype: "Float64", nullable: true, unique_count: 25 },
          ],
          sample: [
            { date: "2024-04-01", temp: 15.5 },
            { date: "2024-04-02", temp: 16.0 },
          ],
          total_rows: 30,
        },
      ],
    });
  }),
];

/**
 * 특수 시나리오 핸들러 (timeout, 5xx retry, network error 등)
 * 일반 핸들러보다 나중에 추가하여 우선순위를 가짐.
 */
export const scenarioHandlers = {
  /**
   * Timeout 시나리오 — 응답이 늦게 도착하도록 지연
   */
  timeout: http.get(`${API_BASE}/timeout`, () => {
    // 40초 지연 (builderApi.ts의 DEFAULT_TIMEOUT_MS=30000ms 초과)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json({ service: "kpubdata-builder", api_version: "1.0.0" }));
      }, 40000);
    });
  }),

  /**
   * 5xx 서버 오류 시나리오 — 재시도 후 최종 실패
   */
  serverError: http.get(`${API_BASE}/server-error`, () => {
    return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
  }),

  /**
   * Network error 시나리오 — 연결 실패
   * (MSW로는 실제 네트워크 오류를 흉내 낼 수 없어, 응답을 받지 않는 핸들러를 등록하지 않음)
   * 테스트에서는 fetch 자체를 reject하는 mock을 사용해야 함.
   */
  networkError: null,
};
