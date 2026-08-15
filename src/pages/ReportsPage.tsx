/**
 * Reports 목록/생성 화면 (`/reports`, #258).
 *
 * 저장된 Report Draft 목록을 관리(열기/이름변경/복제/삭제)하고, 기준 dataset/run을 골라
 * Builder evidence 기반 deterministic Report를 새로 만든다. 실제 편집/블록 구성은
 * `/reports/:reportId`(`ReportEditorPage`)에서 이어진다.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listDatasetRuns, listDatasets } from "@/features/datasets/api";
import { listKubiReportNotes } from "@/features/kubi/reportInbox";
import { buildDeterministicSections } from "@/features/reports/deterministicSections";
import { buildEvidenceRefs, fetchReportEvidence } from "@/features/reports/evidence";
import {
  createReport,
  deleteReport,
  duplicateReport,
  listReportSummaries,
  renameReport,
} from "@/features/reports/repository";
import type { ReportSummary } from "@/features/reports/types";
import type { DatasetRunSummary, DatasetSummary } from "@/shared/lib/builderApi";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select } from "@/shared/ui";

interface AsyncState<T> {
  status: "idle" | "loading" | "loaded" | "error";
  data?: T;
  error?: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [pendingNoteCount, setPendingNoteCount] = useState(0);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [datasetsState, setDatasetsState] = useState<AsyncState<DatasetSummary[]>>({ status: "loading" });
  const [runsState, setRunsState] = useState<AsyncState<DatasetRunSummary[]>>({ status: "idle" });
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function refresh() {
    setSummaries(listReportSummaries());
    setPendingNoteCount(listKubiReportNotes().length);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDatasetsState({ status: "loading" });
    listDatasets(100, controller.signal)
      .then((datasets) => {
        setDatasetsState({ status: "loaded", data: datasets });
        if (datasets.length > 0) setSelectedDatasetId((current) => current || datasets[0].dataset_id);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setDatasetsState({ status: "error", error: cause instanceof Error ? cause.message : "데이터셋 목록을 불러오지 못했습니다." });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) {
      setRunsState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setRunsState({ status: "loading" });
    listDatasetRuns(selectedDatasetId, 50, controller.signal)
      .then((data) => {
        setRunsState({ status: "loaded", data: data.runs });
        setSelectedRunId(data.runs[0]?.run_id ?? "");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setRunsState({ status: "error", error: cause instanceof Error ? cause.message : "run 목록을 불러오지 못했습니다." });
      });
    return () => controller.abort();
  }, [selectedDatasetId]);

  async function handleCreate() {
    if (!selectedDatasetId || !selectedRunId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const evidence = await fetchReportEvidence(selectedDatasetId, selectedRunId);
      const blocks = buildDeterministicSections(evidence);
      const evidenceRefs = buildEvidenceRefs(evidence);
      const datasetTitle = evidence.dataset.ok ? evidence.dataset.value.title : selectedDatasetId;
      const { report, result } = createReport({
        title: `${datasetTitle} · ${selectedRunId} 보고서`,
        datasetId: selectedDatasetId,
        baseRunId: selectedRunId,
        buildSpecDigest: evidence.run.ok ? evidence.run.value.spec_digest : null,
        evidenceFetchedAt: evidence.fetchedAt,
        blocks,
        evidenceRefs,
      });
      if (!result.ok) {
        setCreateError(result.reason);
        return;
      }
      navigate(`/reports/${encodeURIComponent(report.id)}`);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Report를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  }

  function handleRenameSubmit() {
    if (!renameTarget) return;
    const result = renameReport(renameTarget.id, renameTarget.title.trim() || "제목 없음");
    if (!result.ok) {
      setListError(result.reason);
      return;
    }
    setRenameTarget(null);
    refresh();
  }

  function handleDuplicate(id: string) {
    const outcome = duplicateReport(id);
    if (!outcome) return;
    if (!outcome.result.ok) {
      setListError(outcome.result.reason);
      return;
    }
    refresh();
  }

  function handleDelete(id: string) {
    if (!window.confirm("이 Report를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    deleteReport(id);
    refresh();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Reports"
        title="리포트"
        description="Builder evidence를 기준으로 Report를 만들고, Kubi 해석을 참고 블록으로 덧붙여 편집·저장·내보냅니다."
      />

      <Card>
        <p className="text-sm font-semibold">새 Report 만들기</p>
        <p className="mt-1 text-xs text-muted-foreground">
          선택한 dataset/run이 이 Report의 기준으로 고정됩니다. 새 Run이 생겨도 이 Report는 자동으로 바뀌지 않습니다.
        </p>
        {datasetsState.status === "error" ? (
          <ErrorState className="mt-3" message={datasetsState.error ?? "데이터셋 목록을 불러오지 못했습니다."} />
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="report-dataset">
                Dataset
              </label>
              <Select
                id="report-dataset"
                className="mt-1"
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                disabled={datasetsState.status !== "loaded"}
              >
                {(datasetsState.data ?? []).map((dataset) => (
                  <option key={dataset.dataset_id} value={dataset.dataset_id}>
                    {dataset.title} ({dataset.dataset_id})
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="report-run">
                Run
              </label>
              <Select
                id="report-run"
                className="mt-1"
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                disabled={runsState.status !== "loaded" || (runsState.data ?? []).length === 0}
              >
                {(runsState.data ?? []).map((run) => (
                  <option key={run.run_id} value={run.run_id}>
                    {run.run_id} · {run.status}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={handleCreate} loading={creating} disabled={!selectedDatasetId || !selectedRunId}>
              Report 만들기
            </Button>
          </div>
        )}
        {runsState.status === "loaded" && (runsState.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">이 dataset에는 접근 가능한 run이 없습니다.</p>
        ) : null}
        {createError ? <ErrorState className="mt-3" message={createError} /> : null}
      </Card>

      {pendingNoteCount > 0 ? (
        <Card className="border-indigo-200 bg-indigo-50 text-sm dark:border-indigo-900/60 dark:bg-indigo-950/30">
          Kubi 참고 노트 {pendingNoteCount}건이 대기 중입니다. Report를 열어 "Kubi 참고 노트 대기열"에서 추가하거나
          무시할 수 있습니다.
        </Card>
      ) : null}

      {listError ? <ErrorState message={listError} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">저장된 Report</p>
        {summaries.length === 0 ? (
          <EmptyState className="py-8" title="저장된 Report가 없습니다" description="위에서 dataset/run을 선택해 첫 Report를 만들어보세요." />
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {summaries.map((summary) => (
              <li key={summary.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {renameTarget?.id === summary.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      className="w-full max-w-sm rounded-lg border border-input bg-card px-3 py-1.5 text-sm"
                      value={renameTarget.title}
                      onChange={(e) => setRenameTarget({ id: summary.id, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit();
                        if (e.key === "Escape") setRenameTarget(null);
                      }}
                    />
                    <Button size="sm" onClick={handleRenameSubmit}>
                      저장
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRenameTarget(null)}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="truncate text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      onClick={() => navigate(`/reports/${encodeURIComponent(summary.id)}`)}
                    >
                      {summary.title}
                    </button>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {summary.datasetId} · {summary.baseRunId} · 최근 수정 {formatDateTime(summary.updatedAt)}
                    </p>
                  </div>
                )}
                {renameTarget?.id !== summary.id ? (
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground underline hover:text-foreground"
                      onClick={() => setRenameTarget({ id: summary.id, title: summary.title })}
                    >
                      이름변경
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground underline hover:text-foreground"
                      onClick={() => handleDuplicate(summary.id)}
                    >
                      복제
                    </button>
                    <button
                      type="button"
                      className="text-red-700 underline hover:text-red-900 dark:text-red-400"
                      onClick={() => handleDelete(summary.id)}
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
