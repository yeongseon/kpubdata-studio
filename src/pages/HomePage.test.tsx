/**
 * Home 대시보드 KPI wiring 테스트.
 *
 * 검증 대상:
 * - DATASETS → GET /datasets의 authoritative `total` (Builder 1.22.0)
 * - QUALITY WARN (24H) → GET /quality/summary의 `warn_runs`
 * - 각 aggregate 경계가 독립적이다 — 하나가 실패해도 나머지 KPI와 Recent Builds는 유지된다
 * - Recent Builds는 KPI 요청 지연/실패와 무관하게 자기 상태로 렌더된다
 * - `total`을 안 보내는 (구버전) Builder에서는 DATASETS만 "확인 불가"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { mswServer } from "../../vitest.setup";
import { API_BASE } from "@/shared/config/env";
import { HomePage } from "./HomePage";

const BUILDS = [
  { run_id: "r1", status: "ok", started_at: "2026-09-01T08:00:00+00:00", finished_at: "2026-09-01T08:05:00+00:00" },
];

const MONITORING_BUILDS = {
  window: "24h",
  bucket: "hour",
  availability: "available",
  excluded_count: 0,
  buckets: [
    {
      bucket_start: "2026-09-01T08:00:00+00:00",
      bucket_end: "2026-09-01T09:00:00+00:00",
      total: 9,
      success: 9,
      failed: 0,
      cancelled: 0,
    },
  ],
  recent_runs: [],
};

const MONITORING_SUMMARY = {
  generated_at: "2026-09-01T09:00:00+00:00",
  status: "healthy",
  api: { availability: "available", sample_count: 10, p95_latency_ms: 5 },
  queue: { availability: "available", waiting: 0, running: 3, total: 3 },
  workers: { availability: "available", active: 0, capacity: 4, utilization: 0 },
  artifact_store: { availability: "available", last_write_at: null },
};

const QUALITY_SUMMARY = {
  window: "24h",
  generated_at: "2026-09-01T09:00:00+00:00",
  availability: "available",
  total_runs: 7,
  evaluated_runs: 6,
  pass_runs: 2,
  warn_runs: 4,
  fail_runs: 1,
};

/** 기본: 모든 boundary가 정상. 개별 테스트가 필요한 것만 override한다. */
function baseHandlers(overrides: {
  builds?: () => Response | Promise<Response>;
  datasets?: () => Response | Promise<Response>;
  monitoringBuilds?: () => Response | Promise<Response>;
  monitoringSummary?: () => Response | Promise<Response>;
  quality?: () => Response | Promise<Response>;
} = {}) {
  mswServer.use(
    http.get(`${API_BASE}/builds`, overrides.builds ?? (() => HttpResponse.json({ builds: BUILDS }))),
    http.get(
      `${API_BASE}/datasets`,
      overrides.datasets ?? (() => HttpResponse.json({ datasets: [], total: 12 })),
    ),
    http.get(
      `${API_BASE}/monitoring/builds`,
      overrides.monitoringBuilds ?? (() => HttpResponse.json(MONITORING_BUILDS)),
    ),
    http.get(
      `${API_BASE}/monitoring/summary`,
      overrides.monitoringSummary ?? (() => HttpResponse.json(MONITORING_SUMMARY)),
    ),
    http.get(
      `${API_BASE}/quality/summary`,
      overrides.quality ?? (() => HttpResponse.json(QUALITY_SUMMARY)),
    ),
  );
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

/** KPI 라벨이 들어 있는 카드(라벨 span의 부모)를 돌려준다. */
function kpiCard(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HomePage 대시보드 KPI", () => {
  it("DATASETS는 GET /datasets의 authoritative total을, QUALITY WARN은 warn_runs를 보여준다", async () => {
    baseHandlers();
    renderHome();

    expect(await within(kpiCard("DATASETS")).findByText("12")).toBeInTheDocument();
    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
    expect(await within(kpiCard("SUCCEEDED (24H)")).findByText("9")).toBeInTheDocument();
    expect(await within(kpiCard("RUNNING")).findByText("3")).toBeInTheDocument();
  });

  it("dataset aggregate 실패는 DATASETS만 '확인 불가'로 만들고 나머지 KPI는 유지한다", async () => {
    baseHandlers({ datasets: () => HttpResponse.json({ error: "boom" }, { status: 500 }) });
    renderHome();

    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
    expect(await within(kpiCard("SUCCEEDED (24H)")).findByText("9")).toBeInTheDocument();
    // 5xx는 apiFetch가 지수 백오프로 재시도하므로 catch까지 시간이 걸린다.
    expect(
      await within(kpiCard("DATASETS")).findByText("확인 불가", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it("quality aggregate 404(구버전 Builder)는 QUALITY WARN만 '확인 불가'로 만든다", async () => {
    baseHandlers({ quality: () => HttpResponse.json({ error: "not found" }, { status: 404 }) });
    renderHome();

    expect(await within(kpiCard("DATASETS")).findByText("12")).toBeInTheDocument();
    expect(await within(kpiCard("SUCCEEDED (24H)")).findByText("9")).toBeInTheDocument();
    expect(within(kpiCard("QUALITY WARN (24H)")).getByText("확인 불가")).toBeInTheDocument();
  });

  it("monitoring 실패는 monitoring KPI만 degraded로 만들고 DATASETS/QUALITY WARN은 유지한다", async () => {
    baseHandlers({
      monitoringBuilds: () => HttpResponse.json({ error: "x" }, { status: 500 }),
      monitoringSummary: () => HttpResponse.json({ error: "x" }, { status: 500 }),
    });
    renderHome();

    expect(await within(kpiCard("DATASETS")).findByText("12")).toBeInTheDocument();
    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
    expect(
      await within(kpiCard("SUCCEEDED (24H)")).findByText("확인 불가", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(within(kpiCard("RUNNING")).getByText("확인 불가")).toBeInTheDocument();
  });

  it("total을 안 보내는 Builder에서는 DATASETS만 '확인 불가'이고 items.length로 대체하지 않는다", async () => {
    baseHandlers({
      datasets: () =>
        HttpResponse.json({
          datasets: [
            {
              dataset_id: "d.a",
              title: "A",
              sources: [],
              latest_run_id: "r1",
              status: "ok",
              updated_at: null,
              row_counts: {},
              total_row_count: 0,
              stages: {},
              quality: null,
            },
          ],
        }),
    });
    renderHome();

    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
    expect(await within(kpiCard("DATASETS")).findByText("확인 불가")).toBeInTheDocument();
    expect(within(kpiCard("DATASETS")).queryByText("1")).not.toBeInTheDocument();
  });

  it("Recent Builds는 KPI 요청이 지연돼도 자기 데이터를 즉시 렌더한다", async () => {
    baseHandlers({
      datasets: async () => {
        await delay("infinite");
        return HttpResponse.json({ datasets: [], total: 12 });
      },
      quality: async () => {
        await delay("infinite");
        return HttpResponse.json(QUALITY_SUMMARY);
      },
      monitoringBuilds: async () => {
        await delay("infinite");
        return HttpResponse.json(MONITORING_BUILDS);
      },
      monitoringSummary: async () => {
        await delay("infinite");
        return HttpResponse.json(MONITORING_SUMMARY);
      },
    });
    renderHome();

    expect(await screen.findByText("r1")).toBeInTheDocument();
  });

  it("빌드가 없어도 기존 사용자의 aggregate KPI는 정상 표시한다", async () => {
    baseHandlers({
      builds: () => HttpResponse.json({ builds: [] }),
      datasets: () => HttpResponse.json({ datasets: [], total: 3 }),
    });
    renderHome();

    expect(await screen.findByText("작업 현황을 한눈에 확인하세요")).toBeInTheDocument();
    expect(await within(kpiCard("DATASETS")).findByText("3")).toBeInTheDocument();
    expect(await within(kpiCard("SUCCEEDED (24H)")).findByText("9")).toBeInTheDocument();
    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
  });

  it("빌드 목록 실패도 Recent Builds만 에러로 만들고 healthy KPI는 유지한다", async () => {
    baseHandlers({ builds: () => HttpResponse.json({ error: "down" }, { status: 500 }) });
    renderHome();

    expect(
      await screen.findByText("빌드 목록을 불러올 수 없습니다", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(await within(kpiCard("DATASETS")).findByText("12")).toBeInTheDocument();
    expect(await within(kpiCard("SUCCEEDED (24H)")).findByText("9")).toBeInTheDocument();
    expect(await within(kpiCard("QUALITY WARN (24H)")).findByText("4")).toBeInTheDocument();
  });
});

/**
 * 신규 사용자 판정: 빈 build 목록만으로는 부족하다. real 모드에서는 Builder
 * GET /datasets의 authoritative `total`이 0으로 확인돼야 신규 사용자로 확정한다.
 * total을 확인할 수 없으면(구버전 Builder / 404·5xx) 기존 대시보드를 보여준다.
 */
describe("HomePage 신규 사용자 판정", () => {
  const NEW_USER_HEADING = "공공데이터를 쉽게 수집하고 변환하세요";
  const DASHBOARD_HEADING = "작업 현황을 한눈에 확인하세요";

  it("dataset total > 0이고 빌드가 없으면 신규 사용자가 아니다(기존 대시보드)", async () => {
    baseHandlers({
      builds: () => HttpResponse.json({ builds: [] }),
      datasets: () => HttpResponse.json({ datasets: [], total: 3 }),
    });
    renderHome();

    expect(await screen.findByText(DASHBOARD_HEADING)).toBeInTheDocument();
    expect(await within(kpiCard("DATASETS")).findByText("3")).toBeInTheDocument();
    expect(screen.queryByText(NEW_USER_HEADING)).not.toBeInTheDocument();
  });

  it("dataset total = 0이고 빌드가 없으면 신규 사용자 화면을 보여준다", async () => {
    baseHandlers({
      builds: () => HttpResponse.json({ builds: [] }),
      datasets: () => HttpResponse.json({ datasets: [], total: 0 }),
    });
    renderHome();

    expect(await screen.findByText(NEW_USER_HEADING)).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_HEADING)).not.toBeInTheDocument();
  });

  it("dataset total이 없는 구버전 Builder에서는 빈 빌드만으로 신규 사용자로 오판하지 않는다", async () => {
    baseHandlers({
      builds: () => HttpResponse.json({ builds: [] }),
      datasets: () => HttpResponse.json({ datasets: [] }),
    });
    renderHome();

    expect(await screen.findByText(DASHBOARD_HEADING)).toBeInTheDocument();
    expect(await within(kpiCard("DATASETS")).findByText("확인 불가")).toBeInTheDocument();
    expect(screen.queryByText(NEW_USER_HEADING)).not.toBeInTheDocument();
  });

  it("dataset aggregate가 5xx로 실패해도 빈 빌드만으로 신규 사용자로 오판하지 않는다", async () => {
    baseHandlers({
      builds: () => HttpResponse.json({ builds: [] }),
      datasets: () => HttpResponse.json({ error: "boom" }, { status: 500 }),
    });
    renderHome();

    expect(await screen.findByText(DASHBOARD_HEADING)).toBeInTheDocument();
    expect(
      await within(kpiCard("DATASETS")).findByText("확인 불가", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(NEW_USER_HEADING)).not.toBeInTheDocument();
  });
});
