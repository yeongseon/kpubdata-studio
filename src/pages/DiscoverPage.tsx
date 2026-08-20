/**
 * Discover 화면 (`/discover`, #249).
 *
 * Builder 원천 provider/dataset 카탈로그(`GET /catalog`)를 정확 검색·필터로 탐색하고,
 * 선택한 항목을 Add Data Workbench(`/add`, #250)로 넘긴다. 자연어 검색(Kubi, #256)이나
 * 이미 빌드된 데이터셋 목록(Dataset Catalog, `/datasets`, #253)과는 다른 화면이다 —
 * `/catalog`(원본)와 `/datasets`(빌드 결과)를 섞지 않는다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadCatalog } from "@/features/discover/api";
import {
  computeProviderCounts,
  computeServiceKeyCount,
  flattenCatalog,
  matchesProviderFilter,
  matchesQuery,
  matchesServiceKeyFilter,
  uniqueProviders,
  type DiscoverEntry,
} from "@/features/discover/model";
import { providerLabel } from "@/shared/lib/providerLabels";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, TextInput } from "@/shared/ui";

interface CatalogState {
  status: "loading" | "loaded" | "error";
  entries?: DiscoverEntry[];
  error?: string;
}

const selectClassName =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  const load = useCallback(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadCatalog(controller.signal)
      .then((catalog) => setState({ status: "loaded", entries: flattenCatalog(catalog) }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "카탈로그를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  const query = searchParams.get("q") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const onlyRequiresKey = searchParams.get("key") === "1";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next);
  }

  const entries = state.entries ?? [];
  const providerOptions = useMemo(() => uniqueProviders(entries), [entries]);
  const providerCounts = useMemo(() => computeProviderCounts(entries), [entries]);
  const serviceKeyCount = useMemo(() => computeServiceKeyCount(entries), [entries]);

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          matchesQuery(entry, query) &&
          matchesProviderFilter(entry, provider) &&
          matchesServiceKeyFilter(entry, onlyRequiresKey),
      ),
    [entries, query, provider, onlyRequiresKey],
  );

  function startWithDataset(entry: DiscoverEntry) {
    navigate(`/add?provider=${encodeURIComponent(entry.provider)}&dataset=${encodeURIComponent(entry.dataset.name)}`);
  }

  const hasActiveFilters = Boolean(query || provider || onlyRequiresKey);

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-7 sm:px-8 lg:px-10 lg:py-8">
      <PageHeader
        eyebrow="Discover"
        title="데이터 탐색"
        description="Builder 카탈로그에서 provider와 데이터셋을 정확 검색하고, 선택한 데이터로 바로 빌드를 시작하세요."
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1 lg:max-w-[390px]">
            <label htmlFor="discover-search" className="sr-only">
              데이터셋명·기관 검색
            </label>
            <TextInput
              id="discover-search"
              placeholder="데이터셋명·기관 검색"
              value={query}
              onChange={(event) => updateParam("q", event.target.value)}
            />
          </div>
          <label className="min-w-56 flex-1 sm:flex-none">
            <span className="sr-only">Provider</span>
            <select
              aria-label="Provider"
              className={`w-full ${selectClassName}`}
              value={provider}
              onChange={(event) => updateParam("provider", event.target.value)}
            >
              <option value="">Provider 전체 ({entries.length}개)</option>
              {providerOptions.map((item) => (
                <option key={item} value={item}>
                  {providerLabel(item)} ({providerCounts.get(item) ?? 0}개)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyRequiresKey}
              onChange={(event) => updateParam("key", event.target.checked ? "1" : "")}
            />
            서비스 키 필요만 ({serviceKeyCount}개)
          </label>
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} className="ml-auto">
              필터 초기화
            </Button>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState title="카탈로그를 불러오지 못했습니다" message={state.error} onRetry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Builder 카탈로그가 비어 있습니다"
            description="등록된 provider/dataset이 없습니다. Builder 설정을 확인해 주세요."
          />
        ) : visibleEntries.length === 0 ? (
          <EmptyState title="조건에 맞는 데이터셋이 없습니다" description="검색어나 필터를 변경해 보세요." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map((entry) => (
              <Card key={`${entry.provider}/${entry.dataset.name}`} variant="elevated" className="flex flex-col gap-3">
                <div>
                  <p className="font-semibold text-foreground">{entry.dataset.title}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{entry.dataset.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{providerLabel(entry.provider)}</span>
                  {entry.dataset.requires_service_key ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      서비스 키 필요
                    </span>
                  ) : null}
                </div>
                <Button size="sm" onClick={() => startWithDataset(entry)} className="mt-auto">
                  이 데이터로 시작하기
                </Button>
              </Card>
            ))}
          </div>
        )}

        {state.status === "loaded" ? (
          <p className="text-xs text-muted-foreground">{visibleEntries.length}개 표시</p>
        ) : null}
      </Card>
    </main>
  );
}
