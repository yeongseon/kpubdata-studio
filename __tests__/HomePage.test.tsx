import { act, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssistConfig } from "@/features/assistant/config";
import { SUGGESTED_QUESTIONS } from "@/features/kubi/suggestedQuestions";
import { useKubiStore } from "@/features/kubi/useKubiSession";
import { HomePage } from "@/pages/HomePage";
import { useUIStore } from "@/shared/hooks/useUIStore";
import { mswServer } from "../vitest.setup";

const BUILDER_BASE = "http://localhost:8000";

function mockEmptyBuilds() {
  mswServer.use(http.get(`${BUILDER_BASE}/builds`, () => HttpResponse.json({ builds: [] })));
}

/**
 * mock 모드(`VITE_USE_REAL_BUILDER` 미설정)의 `listBuilds()`는 결정적 데모 데이터
 * (DEMO_DATASETS, 항상 succeeded 빌드 포함)를 반환하고 msw를 아예 거치지 않는다
 * (features/runs/api/index.ts) — 그래서 신규 사용자(빌드 0개) 상태를 결정적으로 재현하려면
 * 실제 Builder 연동 모드로 전환해 `/builds` 응답 자체를 msw로 통제해야 한다.
 */
function useEmptyBuildsRealMode() {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
  mockEmptyBuilds();
}

function configureKey() {
  act(() => {
    useAssistConfig.getState().setConfig({ apiKey: "sk-test-key", model: "gpt-4o-mini", baseUrl: "" });
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HomePage", () => {
  it("renders the existing-user dashboard heading and KPI summary once builds load (#248)", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // mock 빌드 이력에 성공한 빌드가 있어 기존 사용자 대시보드(ExistingUserHome)가 렌더된다.
    expect(
      await screen.findByRole("heading", {
        name: "작업 현황을 한눈에 확인하세요",
      }),
    ).toBeInTheDocument();
    // 상태 요약 KPI 카드 라벨
    expect(screen.getByText("DATASETS")).toBeInTheDocument();
    expect(screen.getByText("SUCCEEDED (24H)")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("loads recent builds from the mock builder data", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // 데모 빌드 이력이 최근 빌드 목록에 표시된다.
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
    // 각 빌드 행에서 상세로 이동하는 링크가 있다.
    expect(
      screen.getAllByRole("link", { name: "보기" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("points the new-user '데이터 추가하기' CTA at the canonical /add route, not /add-data (#regression)", async () => {
    useEmptyBuildsRealMode();

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const cta = await screen.findByRole("link", { name: "데이터 추가하기" });
    expect(cta).toHaveAttribute("href", "/add");
  });

  it("uses monitoring success counts and renders unavailable metrics as unavailable, never zero/PASS", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    mswServer.use(
      http.get(`${BUILDER_BASE}/builds`, () => HttpResponse.json({
        builds: [
          { run_id: "ok-run", status: "ok", started_at: "2026-08-31T00:00:00Z", finished_at: "2026-08-31T00:01:00Z" },
          { run_id: "failed-run", status: "failed", started_at: "2026-08-31T00:02:00Z", finished_at: "2026-08-31T00:03:00Z" },
          { run_id: "cancelled-run", status: "cancelled", started_at: "2026-08-31T00:04:00Z", finished_at: "2026-08-31T00:05:00Z" },
        ],
      })),
      http.get(`${BUILDER_BASE}/monitoring/builds`, () => HttpResponse.json({
        window: "24h",
        bucket: "hour",
        availability: "available",
        excluded_count: 0,
        buckets: [{ bucket_start: "2026-08-31T00:00:00Z", bucket_end: "2026-08-31T01:00:00Z", total: 9, success: 7, failed: 1, cancelled: 1 }],
        recent_runs: [],
      })),
    );

    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getAllByText("확인 불가")).toHaveLength(3);
    expect(screen.getByText("품질 경고 집계 확인 불가")).toBeInTheDocument();
    expect(screen.queryByText("품질 경고가 없습니다")).not.toBeInTheDocument();
    expect(screen.queryByText("모든 빌드가 정상적으로 완료되었습니다")).not.toBeInTheDocument();
  });
});

const HERO_HEADING = "Kubi에게 필요한 데이터를 물어보세요";

describe("Home Kubi Hero (#Phase2 UI polish)", () => {
  beforeEach(() => {
    useKubiStore.setState({ turns: [], onboarded: false, pendingSeed: null });
    useAssistConfig.getState().clear();
    act(() => useUIStore.setState({ isKubiDrawerOpen: false }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("shows the Kubi hero only for a new user (no builds/datasets), not on the existing-user dashboard", async () => {
    // 기존 사용자(데모 빌드 이력 존재) — ExistingUserHome에는 Hero가 중복 노출되지 않는다.
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "작업 현황을 한눈에 확인하세요" });
    expect(screen.queryByRole("heading", { name: HERO_HEADING })).not.toBeInTheDocument();
  });

  it("shows exactly one Kubi hero for a new user (empty builds/datasets)", async () => {
    useEmptyBuildsRealMode();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(await screen.findAllByRole("heading", { name: HERO_HEADING })).toHaveLength(1);
  });

  it("configured: submitting a question seeds it into the shared Kubi store and opens the drawer", async () => {
    useEmptyBuildsRealMode();
    configureKey();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText("Kubi에게 자연어로 데이터 물어보기");
    fireEvent.change(input, { target: { value: "서울 대기오염 데이터로 뭘 할 수 있어?" } });
    fireEvent.submit(input.closest("form")!);

    expect(useKubiStore.getState().pendingSeed).toBe("서울 대기오염 데이터로 뭘 할 수 있어?");
    expect(useUIStore.getState().isKubiDrawerOpen).toBe(true);
  });

  it("not configured: submitting opens the drawer but does not seed a question or create a no_key turn", async () => {
    useEmptyBuildsRealMode();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText("Kubi에게 자연어로 데이터 물어보기");
    fireEvent.change(input, { target: { value: "서울 대기오염 데이터로 뭘 할 수 있어?" } });
    fireEvent.submit(input.closest("form")!);

    expect(useUIStore.getState().isKubiDrawerOpen).toBe(true);
    expect(useKubiStore.getState().pendingSeed).toBeNull();
    expect(useKubiStore.getState().turns).toHaveLength(0);
  });

  it("configured: clicking a suggested-question chip seeds that shared question and opens the drawer", async () => {
    useEmptyBuildsRealMode();
    configureKey();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const chip = await screen.findByRole("button", { name: SUGGESTED_QUESTIONS[0] });
    fireEvent.click(chip);

    expect(useKubiStore.getState().pendingSeed).toBe(SUGGESTED_QUESTIONS[0]);
    expect(useUIStore.getState().isKubiDrawerOpen).toBe(true);
  });

  it("empty/whitespace query: does not seed a question or create a turn", async () => {
    useEmptyBuildsRealMode();
    configureKey();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText("Kubi에게 자연어로 데이터 물어보기");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);

    expect(useKubiStore.getState().pendingSeed).toBeNull();
    expect(useKubiStore.getState().turns).toHaveLength(0);
  });
});
