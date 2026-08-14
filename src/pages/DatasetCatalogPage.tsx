import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadDatasetCatalog, type CatalogDataset } from "@/features/datasets/api";
import {
  STAGE_STATUSES,
  datasetHasStageStatus,
  formatDateTime,
  summarizeDatasetStages,
  uniqueProviders,
} from "@/features/datasets/model";
import { QualityBadge } from "@/features/quality/QualityBadge";
import type { ValidationStatus } from "@/features/quality/model";
import type { StageStatus } from "@/shared/lib/builderApi";
import { Button, Card, EmptyState, ErrorState, PageHeader, SkeletonTable, TextInput } from "@/shared/ui";

interface CatalogState {
  status: "loading" | "loaded" | "error";
  datasets?: CatalogDataset[];
  error?: string;
}

const selectClassName =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const stageSummaryClass = {
  bronze: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  silver: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  gold: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200",
  warning: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
} as const;

export function DatasetCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  const load = useCallback(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadDatasetCatalog(controller.signal)
      .then((datasets) => setState({ status: "loaded", datasets }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "데이터셋 목록을 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  const query = searchParams.get("q") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const stage = searchParams.get("stage") ?? "";
  const validation = searchParams.get("validation") ?? "";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next);
  }

  const providerOptions = useMemo(
    () => uniqueProviders((state.datasets ?? []).flatMap((dataset) => dataset.sources)),
    [state.datasets],
  );

  const visibleDatasets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (state.datasets ?? []).filter((dataset) => {
      const matchesQuery =
        !normalizedQuery ||
        dataset.dataset_id.toLocaleLowerCase().includes(normalizedQuery) ||
        dataset.title.toLocaleLowerCase().includes(normalizedQuery) ||
        dataset.sources.some((source) =>
          `${source.provider} ${source.dataset} ${source.alias}`.toLocaleLowerCase().includes(normalizedQuery),
        );
      const matchesProvider = !provider || dataset.sources.some((source) => source.provider === provider);
      const matchesStage = !stage || datasetHasStageStatus(dataset, stage as StageStatus);
      const matchesValidation = !validation || dataset.validation === validation;
      return matchesQuery && matchesProvider && matchesStage && matchesValidation;
    });
  }, [state.datasets, query, provider, stage, validation]);

  function openDataset(datasetId: string) {
    navigate(`/datasets/${encodeURIComponent(datasetId)}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-7 sm:px-8 lg:px-10 lg:py-8">
      <PageHeader
        eyebrow="Data"
        title="Dataset Catalog"
        description="정확 검색과 필터로 데이터셋을 찾습니다."
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className="min-w-56 flex-1 lg:max-w-[390px]">
            <label htmlFor="dataset-search" className="sr-only">
              Dataset / Provider 검색
            </label>
            <TextInput id="dataset-search" placeholder="데이터셋명·기관 검색" value={query} onChange={(event) => updateParam("q", event.target.value)} />
          </div>
          <label className="min-w-36 flex-1 sm:flex-none">
            <span className="sr-only">Provider</span>
            <select aria-label="Provider" className={`w-full ${selectClassName}`} value={provider} onChange={(event) => updateParam("provider", event.target.value)}>
              <option value="">Provider 전체</option>
              {providerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="min-w-32 flex-1 sm:flex-none">
            <span className="sr-only">Stage 상태</span>
            <select aria-label="Stage 상태" className={`w-full ${selectClassName}`} value={stage} onChange={(event) => updateParam("stage", event.target.value)}>
              <option value="">Stage 전체</option>
              {STAGE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="min-w-36 flex-1 sm:flex-none">
            <span className="sr-only">Validation</span>
            <select aria-label="Validation" className={`w-full ${selectClassName}`} value={validation} onChange={(event) => updateParam("validation", event.target.value)}>
              <option value="">Validation 전체</option>
              {(["PASS", "WARN", "FAIL", "N/A"] satisfies ValidationStatus[]).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {state.status === "loading" ? (
          <SkeletonTable rows={5} className="w-full" />
        ) : state.status === "error" ? (
          <ErrorState title="데이터셋 목록을 불러오지 못했습니다" message={state.error} onRetry={load} />
        ) : visibleDatasets.length === 0 ? (
          <EmptyState title="조건에 맞는 데이터셋이 없습니다" description="검색어나 필터를 변경해 보세요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Dataset</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Validation</th><th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleDatasets.map((dataset) => (
                  <tr
                    key={dataset.dataset_id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${dataset.title} 상세 열기`}
                    className="cursor-pointer border-b border-border align-top transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:border-0"
                    onClick={() => openDataset(dataset.dataset_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDataset(dataset.dataset_id);
                      }
                    }}
                  >
                    <td className="px-5 py-4"><p className="font-semibold text-foreground">{dataset.title}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{dataset.dataset_id}</p></td>
                    <td className="px-5 py-4">{uniqueProviders(dataset.sources).join(", ")}</td>
                    <td className="px-5 py-4">{(() => {
                      const summary = summarizeDatasetStages(dataset.stages);
                      return <span title={summary.description} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageSummaryClass[summary.tone]}`}>{summary.label}</span>;
                    })()}</td>
                    <td className="px-5 py-4"><QualityBadge status={dataset.validation} />{dataset.qualityError ? <p className="mt-1 max-w-44 text-xs text-muted-foreground">Quality 조회 실패</p> : null}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDateTime(dataset.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.status === "loaded" ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{visibleDatasets.length}개 표시</span>
            {(query || provider || stage || validation) ? <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>필터 초기화</Button> : null}
          </div>
        ) : null}
      </Card>
    </main>
  );
}
