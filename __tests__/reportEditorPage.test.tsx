/**
 * ReportEditorPage IA 개편 회귀 테스트 (#258).
 *
 * - Builder evidence 요약 문장이 실제 evidence 값과 일치하는지(0/PASS로 꾸미지 않는지)
 * - 상세 evidence 표가 여전히 존재하고 펼칠 수 있는지
 * - Kubi/Builder 블록이 시각적으로 구분되는지
 * - Report Context sidebar가 실제 값만 보여주는지
 * - STALE이어도 baseRunId가 자동으로 바뀌지 않는지, Kubi 진입 시에도 고정된 dataset/run만
 *   context로 넘어가는지(최신 run으로 자동 전환 금지)
 * - 좁은 viewport에서 sidebar가 아래로 collapse하는 반응형 grid recipe가 그대로인지
 * - PDF/DOCX CTA가 없는지
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDeterministicSections } from "@/features/reports/deterministicSections";
import { buildEvidenceRefs, fetchReportEvidence } from "@/features/reports/evidence";
import { createReport, getReport, saveReport } from "@/features/reports/repository";
import type { KubiInterpretationBlock, ReportDraft } from "@/features/reports/types";
import { ReportEditorPage } from "@/pages/ReportEditorPage";
import { useUIStore } from "@/shared/hooks/useUIStore";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderReport(reportId: string) {
  return render(
    <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
      <LocationProbe />
      <Routes>
        <Route path="/reports/:reportId" element={<ReportEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function makeReport(datasetId: string, runId: string, titlePrefix = "테스트"): Promise<ReportDraft> {
  const evidence = await fetchReportEvidence(datasetId, runId);
  const blocks = buildDeterministicSections(evidence);
  const evidenceRefs = buildEvidenceRefs(evidence);
  const { report, result } = createReport({
    title: `${titlePrefix} · ${runId}`,
    datasetId,
    baseRunId: runId,
    buildSpecDigest: evidence.run.ok ? evidence.run.value.spec_digest : null,
    evidenceFetchedAt: evidence.fetchedAt,
    blocks,
    evidenceRefs,
  });
  if (!result.ok) throw new Error(result.reason);
  return report;
}

function makeKubiBlock(overrides: Partial<KubiInterpretationBlock> = {}): KubiInterpretationBlock {
  const now = new Date().toISOString();
  return {
    id: "kubi-1",
    provenance: "KUBI_INTERPRETATION",
    note: "가격 결측이 특정 지역에 집중됩니다.",
    reason: "품질 이슈 참고용",
    sourceContext: { datasetId: "air-quality", runId: "air-2026-08-14" },
    isSameContext: true,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ isKubiDrawerOpen: false });
});

afterEach(() => {
  localStorage.clear();
});

describe("ReportEditorPage IA 개편 (#258)", () => {
  it("Builder evidence 요약 문장이 실제 PASS/FAIL 수치와 동일하게 표시된다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-14");
    renderReport(report.id);

    await screen.findByText(/이 보고서는/);
    expect(screen.getByText(/1건은 PASS/)).toBeInTheDocument();
    expect(screen.getByText(/1건은 FAIL/)).toBeInTheDocument();
    expect(screen.queryByText(/0건은 WARN/)).not.toBeInTheDocument();
  });

  it("unavailable evidence를 0/PASS로 문장화하지 않는다", async () => {
    const report = await makeReport("population", "population-2026-08-13");
    renderReport(report.id);

    await screen.findByText(/PASS로 간주하지 않습니다/);
    expect(screen.queryByText(/\d건은 PASS/)).not.toBeInTheDocument();
  });

  it("상세 evidence 표는 지워지지 않고 펼쳐서 볼 수 있다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-14");
    renderReport(report.id);

    const schemaBlock = await screen.findByTestId("block-schema");
    // dtype(datetime)은 요약 문장이 아니라 상세 표에만 있다 — 펼치기 전에는 없어야 한다.
    expect(within(schemaBlock).queryByText("datetime")).not.toBeInTheDocument();

    fireEvent.click(within(schemaBlock).getByText("상세 근거 보기"));
    expect(await within(schemaBlock).findByText("datetime")).toBeInTheDocument();
  });

  it("Kubi 블록과 Builder Evidence 블록이 provenance 배지로 시각적으로 구분된다", async () => {
    let report = await makeReport("air-quality", "air-2026-08-14");
    report = { ...report, blocks: [...report.blocks, makeKubiBlock()] };
    saveReport(report, { force: true });

    renderReport(report.id);

    await screen.findByTestId("block-kubi");
    expect(screen.getByText("Kubi 분석 · AI 작성")).toBeInTheDocument();
    expect(screen.getAllByText("Builder Evidence").length).toBeGreaterThan(0);
    expect(screen.getByText("AI 작성 · Kubi")).toBeInTheDocument();
  });

  it("Report Context sidebar가 실제 base dataset/run/evidence 상태를 보여준다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-14");
    renderReport(report.id);

    const contextHeading = await screen.findByText("Report Context");
    const contextCard = contextHeading.parentElement as HTMLElement;
    expect(within(contextCard).getByText("air-quality")).toBeInTheDocument();
    expect(within(contextCard).getByText("air-2026-08-14")).toBeInTheDocument();
    await screen.findByText(/CURRENT/);
  });

  it("STALE이어도 baseRunId를 자동으로 바꾸지 않는다(최신 run 자동 전환 금지)", async () => {
    // air-2026-08-13은 최신이 아니다(최신은 air-2026-08-14) → STALE 판정이 나와야 한다.
    const report = await makeReport("air-quality", "air-2026-08-13");
    renderReport(report.id);

    await screen.findByText(/STALE/);
    expect(getReport(report.id)?.baseRunId).toBe("air-2026-08-13");

    // "다시 확인"을 눌러도 마찬가지다.
    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
    await waitFor(() => expect(screen.getByText(/STALE/)).toBeInTheDocument());
    expect(getReport(report.id)?.baseRunId).toBe("air-2026-08-13");
  });

  it("Kubi로 분석하기는 Report가 고정한 dataset/run만 context로 넘기고 최신 run으로 바꾸지 않는다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-13");
    renderReport(report.id);

    await screen.findByText(/STALE/); // 최신 run(air-2026-08-14)이 따로 있는 상태에서도

    fireEvent.click(screen.getByRole("button", { name: "현재 문맥으로 Kubi 분석" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toContain("dataset=air-quality");
    });
    expect(screen.getByTestId("location").textContent).toContain("run=air-2026-08-13");
    expect(screen.getByTestId("location").textContent).not.toContain("air-2026-08-14");
    expect(useUIStore.getState().isKubiDrawerOpen).toBe(true);
  });

  it("좁은 viewport에서 sidebar가 아래로 collapse하는 반응형 grid를 그대로 유지한다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-14");
    renderReport(report.id);

    const grid = await screen.findByTestId("report-layout-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toMatch(/lg:grid-cols-\[/);
  });

  it("PDF/DOCX 다운로드 CTA를 제공하지 않는다", async () => {
    const report = await makeReport("air-quality", "air-2026-08-14");
    renderReport(report.id);

    await screen.findByText(/이 보고서는/);
    expect(screen.queryByText(/PDF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DOCX/i)).not.toBeInTheDocument();
  });
});
