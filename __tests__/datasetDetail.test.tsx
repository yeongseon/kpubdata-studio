import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasetDetailPage } from "@/pages/DatasetDetailPage";
import { useUIStore } from "@/shared/hooks/useUIStore";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderDetail(initialEntry = "/datasets/air-quality") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes><Route path="/datasets/:datasetId" element={<DatasetDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "false");
  act(() => useUIStore.setState({ isKubiDrawerOpen: false }));
});
afterEach(() => vi.unstubAllEnvs());

describe("Dataset Detail P0 (#253)", () => {
  it("defaults to latest run and the highest completed stage", async () => {
    renderDetail();
    expect(await screen.findByLabelText("Run 선택")).toHaveValue("air-2026-08-14");
    await waitFor(() => expect(screen.getByRole("button", { name: /gold completed/ })).toHaveAttribute("aria-pressed", "true"));
  });

  it("selects an accessible historical run from the URL", async () => {
    renderDetail("/datasets/air-quality?run=air-2026-08-13");
    expect(await screen.findByLabelText("Run 선택")).toHaveValue("air-2026-08-13");
    expect(screen.getByTestId("location")).toHaveTextContent("run=air-2026-08-13");
  });

  it("does not silently replace an invalid run with latest", async () => {
    renderDetail("/datasets/air-quality?run=missing-run");
    expect(await screen.findByRole("alert")).toHaveTextContent("선택한 run에 접근할 수 없습니다");
    expect(screen.getByTestId("location")).toHaveTextContent("run=missing-run");
    expect(screen.queryByLabelText("Run 선택")).not.toBeInTheDocument();
  });

  it("keeps an invalid source visible in the select with a recovery path", async () => {
    renderDetail("/datasets/air-quality?source=ghost__source");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost__source");
    const sourceSelect = screen.getByLabelText("Source 선택");
    expect(sourceSelect).toHaveValue("ghost__source");
    expect(within(sourceSelect).getByRole("option", { selected: true })).toHaveTextContent(
      "존재하지 않는 source",
    );
    fireEvent.change(sourceSelect, { target: { value: "datago__air" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("source=datago__air"));
  });

  it("removes an invalid stage param from the URL to match the fallback UI", async () => {
    renderDetail("/datasets/air-quality?stage=platinum");
    await screen.findByLabelText("Run 선택");
    await waitFor(() => expect(screen.getByTestId("location")).not.toHaveTextContent("stage=platinum"));
    expect(screen.getByLabelText("Stage 선택")).toHaveValue("gold");
  });

  it("synchronizes source selection and chooses bronze when no higher stage completed", async () => {
    renderDetail();
    const sourceSelect = await screen.findByLabelText("Source 선택");
    await waitFor(() => expect(sourceSelect).toBeEnabled());
    fireEvent.change(sourceSelect, { target: { value: "kma__weather" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("source=kma__weather"));
    expect(screen.getByRole("button", { name: /bronze completed/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /silver failed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gold not_run/ })).toBeInTheDocument();
  });

  it("updates the stage URL from lineage and applies it to Schema context", async () => {
    renderDetail("/datasets/air-quality?stage=silver&tab=schema");
    expect(await screen.findByText("observed_at")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stage 선택"), { target: { value: "bronze" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("stage=bronze"));
    expect(await screen.findByText("Schema 없음/지원되지 않음")).toBeInTheDocument();
  });

  it("shows only the persisted Silver sample and no fake Gold preview", async () => {
    renderDetail("/datasets/air-quality?stage=silver&tab=preview");
    expect(await screen.findByText("2026-08-14T00:00:00Z")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stage 선택"), { target: { value: "gold" } });
    expect(await screen.findByText("미리보기 없음/지원되지 않음")).toBeInTheDocument();
  });

  it("renders all six tabs", async () => {
    renderDetail();
    const tablist = await screen.findByRole("tablist", { name: "Dataset detail tabs" });
    for (const label of ["Overview", "Schema", "Preview", "Quality", "Builds", "AI"]) {
      expect(within(tablist).getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("shows unavailable lineage nodes without presenting them as completed", async () => {
    renderDetail("/datasets/population");
    const gold = await screen.findByRole("button", { name: "gold unavailable" });
    expect(gold).toHaveAttribute("aria-pressed", "false");
    expect(within(gold).getByText("unavailable")).toBeInTheDocument();
  });

  it.each([
    ["/datasets/air-quality?source=datago__air&tab=quality", "PASS"],
    ["/datasets/air-quality?source=kma__weather&tab=quality", "FAIL"],
    ["/datasets/population?source=kosis__population&tab=quality", "N/A"],
  ])("shows actual scoped quality without inventing a score: %s", async (path, expected) => {
    renderDetail(path);
    const panel = await screen.findByRole("tabpanel", { name: "Quality" });
    expect((await within(panel).findAllByText(expected)).length).toBeGreaterThan(0);
    expect(within(panel).queryByText(/score/i)).not.toBeInTheDocument();
  });

  it("shows run history and links each run to build detail", async () => {
    renderDetail("/datasets/air-quality?tab=builds");
    const panel = await screen.findByRole("tabpanel", { name: "Builds" });
    expect(within(panel).getByText(/air-2026-08-13/)).toBeInTheDocument();
    expect(within(panel).getAllByRole("link", { name: "보기" })[0]).toHaveAttribute("href", "/builds/air-2026-08-14");
  });

  it("renders Kubi inline on the AI tab with this dataset's context, not a drawer launcher (#256 review)", async () => {
    renderDetail("/datasets/air-quality?tab=ai");
    const panel = await screen.findByRole("tabpanel", { name: "AI" });
    // 프로토타입처럼 AI 탭 자체가 Kubi 전체 화면(context bar/질문/답변)이어야 한다 — drawer를 대신 여는 launcher card가 아니다.
    expect(within(panel).getByText("air-quality")).toBeInTheDocument();
    expect(within(panel).getByText(/BYOK/)).toBeInTheDocument();
    expect(useUIStore.getState().isKubiDrawerOpen).toBe(false);
  });

  it("AI tab demo (no API key, mock mode): Generated SQL and Result Preview render deterministically, clearly labeled as demo (#256 review)", async () => {
    renderDetail("/datasets/air-quality?tab=ai&stage=silver");
    const panel = await screen.findByRole("tabpanel", { name: "AI" });

    fireEvent.click(within(panel).getByRole("button", { name: "데모 질문 보내보기" }));

    expect(await within(panel).findByText(/DEMO/)).toBeInTheDocument();
    expect(within(panel).getByText(/SELECT region, COUNT\(\*\)/)).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "실행" }));

    expect(await within(panel).findByText("서울")).toBeInTheDocument();
    expect(within(panel).getByText("123")).toBeInTheDocument();
  });
});
