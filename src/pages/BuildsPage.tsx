/**
 * Builds / Runs master-detail 화면 (`/builds`, `/builds?run=<id>`, 레거시 `/builds/:buildId`, #255).
 *
 * 상단 KPI → Run 목록(master) → 선택 Run 상세(Pipeline/Stage Progress, Quality, Failure
 * evidence, Artifacts/Dataset navigation) 구조로 Builder 상태를 있는 그대로 보여준다.
 * Studio는 Builder가 반환한 값을 재계산하거나 추측하지 않는다(#246 원칙).
 *
 * 데이터 표면별로 독립된 상태를 유지한다 — Quality/Artifact/BuildSpec snapshot 중 하나가
 * 실패해도 Run 기본 정보와 Stage Progress는 계속 보여야 한다(#255 §8/§13).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { parse as parseYaml } from "yaml";
import { getBuildQuality, listBuildStages } from "@/features/datasets/api";
import { DATASET_STAGES, formatDateTime } from "@/features/datasets/model";
import { StageBadge } from "@/features/datasets/components/StageBadge";
import { QualityBadge, QualityStateBadge } from "@/features/quality/QualityBadge";
import { overallQualityState } from "@/features/quality/model";
import {
  classifyRunApiError,
  collectFailureEvidence,
  computeBuildKpi,
  failQualityResults,
  failedRunEvents,
  matchesSearch,
  matchesStatusFilter,
  summarizeMultiSourceOutcome,
  type RunStatusFilter,
} from "@/features/runs/model";
import { isTerminalBuilderStatus, listBuilds } from "@/features/runs/api";
import { getBuildSpecSnapshot } from "@/features/runs/api/runDetail";
import { useSelectedRunPolling } from "@/features/runs/useSelectedRunPolling";
import { useRunEvents, type RunEventsState } from "@/features/runs/useRunEvents";
import { EventTimeline } from "@/features/runs/components/EventTimeline";
import { KubiRunAnalysis } from "@/features/runs/components/KubiRunAnalysis";
import { useKubiStore } from "@/features/kubi/useKubiSession";
import { useUIStore } from "@/shared/hooks/useUIStore";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildQualityResponse, BuildSpecSnapshotResponse, RunStagesResponse } from "@/shared/lib/builderApi";
import type { BuildListItem, BuildRunStatus } from "@/shared/lib/types";
import {
  Button,
  Card,
  Disclosure,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  SkeletonTable,
  Skeleton,
  StatusBadge,
  TextInput,
} from "@/shared/ui";

/** `/builds` 요청 scope. Builder에 전체 count가 없으므로 KPI는 반드시 이 값 안에서만 계산한다. */
const LIST_LIMIT = 100;

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "error"; error: string; notFound?: boolean; permissionDenied?: boolean };

const STATUS_FILTERS: { value: RunStatusFilter; label: string }[] = [
  { value: "all", label: "전체 상태" },
  { value: "succeeded", label: "성공" },
  { value: "failed", label: "실패" },
  { value: "running", label: "실행 중" },
  { value: "queued", label: "대기 중" },
  { value: "cancelled", label: "취소됨" },
];

function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  errorMessage: string,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "loaded", data });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const kind = classifyRunApiError(cause);
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : errorMessage,
          notFound: kind === "not_found",
          permissionDenied: kind === "permission_denied",
        });
      });
    return () => controller.abort();
  }, deps);

  return state;
}

export function BuildsPage() {
  const { buildId: legacyRunId } = useParams<{ buildId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [listState, setListState] = useState<AsyncState<BuildListItem[]>>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>("all");

  const loadList = useCallback(() => {
    const controller = new AbortController();
    setListState({ status: "loading" });
    listBuilds(LIST_LIMIT)
      .then((items) => {
        if (!controller.signal.aborted) setListState({ status: "loaded", data: items });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setListState({
          status: "error",
          error: cause instanceof Error ? cause.message : "빌드 목록을 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => loadList(), [loadList]);

  // 새 canonical form은 ?run=. 레거시 /builds/:buildId 딥링크도 같은 context를 연다(#255 §5).
  // 둘 다 있으면 canonical(?run=)이 우선한다.
  const selectedRunId = searchParams.get("run") || legacyRunId || null;

  const selectRun = useCallback(
    (runId: string) => {
      navigate(`/builds?run=${encodeURIComponent(runId)}`);
    },
    [navigate],
  );

  const clearSelection = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("run");
    // dataset/stage는 selected Run에서 파생된 Kubi context 값이다(#255 §2) — run 선택을
    // 지우면 함께 지워 다음 화면에 이전 run의 문맥이 남지 않게 한다.
    next.delete("dataset");
    next.delete("stage");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const items = listState.status === "loaded" ? listState.data : [];
  const runningAvailable = !isRealBuilderEnabled();
  const kpi = useMemo(() => computeBuildKpi(items, LIST_LIMIT, runningAvailable), [items, runningAvailable]);

  const visible = useMemo(
    () => items.filter((item) => matchesSearch(item, query) && matchesStatusFilter(item, statusFilter)),
    [items, query, statusFilter],
  );

  const selectedListItem = items.find((item) => item.id === selectedRunId) ?? null;
  const outOfListScope = Boolean(selectedRunId) && listState.status === "loaded" && !selectedListItem;
  const hiddenByFilter = Boolean(
    selectedListItem && !visible.some((item) => item.id === selectedListItem.id),
  );

  const stagesState = useAsync<RunStagesResponse>(
    (signal) => (selectedRunId ? listBuildStages(selectedRunId, signal) : Promise.reject(new Error("no run"))),
    [selectedRunId],
    "Stage 상태를 불러오지 못했습니다.",
  );
  const qualityState = useAsync<BuildQualityResponse>(
    (signal) => (selectedRunId ? getBuildQuality(selectedRunId, signal) : Promise.reject(new Error("no run"))),
    [selectedRunId],
    "Quality 결과를 불러오지 못했습니다.",
  );
  const specState = useAsync<BuildSpecSnapshotResponse>(
    (signal) => (selectedRunId ? getBuildSpecSnapshot(selectedRunId, signal) : Promise.reject(new Error("no run"))),
    [selectedRunId],
    "BuildSpec snapshot을 불러오지 못했습니다.",
  );

  const live = useSelectedRunPolling(selectedRunId);

  // event polling도 selected Run polling과 같은 "non-terminal이면 계속, terminal이면 멈춤"
  // 정책을 따른다(#255 §3). listItem의 historical 상태는 표시에는 쓰되(RunDetailPanel의
  // runStatus), interval polling을 켜는 판단에는 쓰지 않는다 — 확인된 live job이 실제로
  // non-terminal일 때만 polling을 시작한다(useSelectedRunPolling과 동일한 원칙).
  const eventsPollingEnabled = live.kind === "job" && !isTerminalBuilderStatus(live.job.status);
  const eventsState = useRunEvents(selectedRunId, eventsPollingEnabled);

  // Kubi Run context(#256)는 새 context store 없이, 기존 route resolver(features/kubi/context.ts)가
  // 읽는 `?run=&dataset=&stage=` 쿼리 관례를 그대로 재사용한다(Quality/Dataset Detail과 동일).
  // 이 화면에서 실제로 확인된 값만 반영한다 — failure message를 파싱해 stage를 추측하지 않고,
  // 정확히 하나의 source만 실패했을 때만 그 failedStage를 안전한 문맥으로 취급한다(#255 §2).
  useEffect(() => {
    if (!selectedRunId) return;
    const datasetId = specState.status === "loaded" ? extractDatasetId(specState.data.spec) : null;
    const failureEvidence =
      stagesState.status === "loaded" ? collectFailureEvidence(stagesState.data.sources) : [];
    const stage = failureEvidence.length === 1 ? failureEvidence[0].failedStage : null;

    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (datasetId) {
      if (next.get("dataset") !== datasetId) {
        next.set("dataset", datasetId);
        changed = true;
      }
    } else if (next.has("dataset")) {
      next.delete("dataset");
      changed = true;
    }
    if (stage) {
      if (next.get("stage") !== stage) {
        next.set("stage", stage);
        changed = true;
      }
    } else if (next.has("stage")) {
      next.delete("stage");
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [selectedRunId, specState, stagesState, searchParams, setSearchParams]);

  // Run 자체가 존재하지 않는다고 판정하는 기준: 목록 scope 밖이고, stage 조회도 404다.
  // (stage endpoint는 목록 limit과 무관하게 임의 run_id를 바로 조회할 수 있어 더 신뢰할 수 있는 신호)
  const runNotFound =
    Boolean(selectedRunId) &&
    listState.status === "loaded" &&
    !selectedListItem &&
    stagesState.status === "error" &&
    stagesState.notFound;

  // 목록 scope 밖이라 존재 여부를 판단할 근거(listItem)가 없는데, 그 판단 근거로 쓰던
  // stage 조회마저 403이면 "없다"가 아니라 "조회할 권한이 없다"로 구분한다(#255 P0).
  // 404와 절대 뭉개지 않는다 — 둘 다 "정보를 못 봤다"는 같은 결과가 아니다.
  const runPermissionDenied =
    Boolean(selectedRunId) &&
    listState.status === "loaded" &&
    !selectedListItem &&
    stagesState.status === "error" &&
    stagesState.permissionDenied;

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      {/* App Shell topbar에 이미 전역 "새 빌드 만들기" CTA가 있다(#255 §1) — 여기서는 중복 action을
          추가하지 않는다. */}
      <PageHeader
        eyebrow="Builds / Runs"
        title="빌드 실행 이력"
        description="Run 상태, Stage Progress, Quality, Failure evidence를 한 화면에서 확인합니다."
      />

      <KpiRow kpi={kpi} />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <RunListPanel
          listState={listState}
          visible={visible}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          selectedRunId={selectedRunId}
          onSelect={selectRun}
          onRetry={loadList}
          hiddenByFilter={hiddenByFilter}
        />

        {selectedRunId ? (
          runNotFound ? (
            <Card variant="error" role="alert">
              <p className="font-semibold">Run을 찾을 수 없습니다: {selectedRunId}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                목록 조회 범위(최대 {LIST_LIMIT}건)에도 없고 stage 정보 조회도 404입니다. 삭제되었거나
                존재한 적 없는 run_id일 수 있습니다.
              </p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-accent-subtle-foreground underline"
                onClick={clearSelection}
              >
                선택 해제
              </button>
            </Card>
          ) : runPermissionDenied ? (
            <Card variant="error" role="alert">
              <p className="font-semibold">이 Run을 조회할 권한이 없습니다: {selectedRunId}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                목록 조회 범위(최대 {LIST_LIMIT}건)에도 없어 존재 여부를 판단할 다른 근거가 없고, stage 정보
                조회는 403(권한 없음)입니다. Run이 없는 것인지 접근 권한이 없는 것인지는 Studio가 추측하지
                않습니다.
              </p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-accent-subtle-foreground underline"
                onClick={clearSelection}
              >
                선택 해제
              </button>
            </Card>
          ) : (
            <RunDetailPanel
              runId={selectedRunId}
              listItem={selectedListItem}
              outOfListScope={outOfListScope}
              stagesState={stagesState}
              qualityState={qualityState}
              specState={specState}
              eventsState={eventsState}
              live={live}
            />
          )
        ) : (
          <Card className="flex min-h-64 items-center justify-center">
            <EmptyState title="Run을 선택하세요" description="왼쪽 목록에서 확인할 Run을 선택하면 상세 정보가 표시됩니다." />
          </Card>
        )}
      </div>
    </main>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function KpiRow({ kpi }: { kpi: ReturnType<typeof computeBuildKpi> }) {
  const scopeHint = `조회된 ${kpi.scopeCount}건 · limit ${kpi.scopeLimit}${kpi.scopeCount >= kpi.scopeLimit ? " (더 있을 수 있음)" : ""}`;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KpiTile label="Builds (조회 범위)" value={String(kpi.scopeCount)} hint={scopeHint} />
      <KpiTile label="Success" value={String(kpi.succeeded)} hint="조회 범위 기준" />
      <KpiTile label="Failed" value={String(kpi.failed)} hint="조회 범위 기준" />
      <KpiTile
        label="Running"
        value={kpi.runningAvailable ? String(kpi.running) : "N/A"}
        hint={
          kpi.runningAvailable
            ? "조회 범위 기준"
            : "Builder GET /builds는 완료된 이력만 반환합니다 (실행 중 job은 포함되지 않음)"
        }
      />
    </div>
  );
}

function RunListPanel({
  listState,
  visible,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  selectedRunId,
  onSelect,
  onRetry,
  hiddenByFilter,
}: {
  listState: AsyncState<BuildListItem[]>;
  visible: BuildListItem[];
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: RunStatusFilter;
  onStatusFilterChange: (value: RunStatusFilter) => void;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  onRetry: () => void;
  hiddenByFilter: boolean;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          aria-label="Run 검색"
          placeholder="run id 또는 제목 검색"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="flex-1"
        />
        <Select
          aria-label="상태 필터"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as RunStatusFilter)}
          className="sm:w-36"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {hiddenByFilter ? (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          선택한 Run은 현재 검색/필터 조건 밖에 있어 목록에는 보이지 않지만, 오른쪽 상세는 계속 표시됩니다.
        </p>
      ) : null}

      {listState.status === "loading" ? (
        <SkeletonTable rows={6} />
      ) : listState.status === "error" ? (
        <ErrorState title="빌드 목록을 불러오지 못했습니다" message={listState.error} onRetry={onRetry} />
      ) : visible.length === 0 ? (
        <EmptyState title="표시할 Run이 없습니다" description="검색어나 상태 필터를 조정해 보세요." />
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={item.id === selectedRunId ? "true" : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  item.id === selectedRunId
                    ? "border-accent bg-accent-subtle"
                    : "border-transparent hover:border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{item.title ?? item.id}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono">{item.id}</span>
                  <span>{formatDateTime(item.startedAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RunDetailPanel({
  runId,
  listItem,
  outOfListScope,
  stagesState,
  qualityState,
  specState,
  eventsState,
  live,
}: {
  runId: string;
  listItem: BuildListItem | null;
  outOfListScope: boolean;
  stagesState: AsyncState<RunStagesResponse>;
  qualityState: AsyncState<BuildQualityResponse>;
  specState: AsyncState<BuildSpecSnapshotResponse>;
  eventsState: RunEventsState;
  live: ReturnType<typeof useSelectedRunPolling>;
}) {
  const openKubiDrawer = useUIStore((state) => state.openKubiDrawer);
  const seedKubiQuestion = useKubiStore((state) => state.seedQuestion);

  // "이 Run 분석"은 더 이상 전역 Kubi drawer를 자동으로 열지 않는다(#255 §2) — 대신 이 Run summary
  // 바로 아래에 inline card를 펼친다. Run을 바꾸면 카드를 닫아, 이전 Run의 분석 결과가 새 Run의
  // context에서 유효한 것처럼 보이지 않게 한다(#256 stale-context guard와 같은 원칙).
  const [showKubiAnalysis, setShowKubiAnalysis] = useState(false);
  useEffect(() => {
    setShowKubiAnalysis(false);
  }, [runId]);

  const sources = stagesState.status === "loaded" ? stagesState.data.sources : [];
  const outcome = stagesState.status === "loaded" ? summarizeMultiSourceOutcome(sources) : "unavailable";
  const failureEvidence = stagesState.status === "loaded" ? collectFailureEvidence(sources) : [];
  const qualityStatus =
    qualityState.status === "loaded"
      ? overallQualityState(qualityState.data)
      : qualityState.status === "error"
        ? "UNAVAILABLE"
        : undefined;
  const qualityFails = qualityState.status === "loaded" ? failQualityResults(qualityState.data) : [];
  const events = eventsState.status === "loaded" ? eventsState.data.events : [];
  const failedEvents = failedRunEvents(events);

  // Run 전체 status: registry에 살아있는 job(live)이 있으면 그 값이 가장 최신이다.
  // 없으면(historical) 목록 요약(listItem.status)을 신뢰한다 — 절대 stage 상태를 run status로
  // 뭉개서 재계산하지 않는다(#255 §6 원칙).
  const runStatus: BuildRunStatus | null = live.kind === "job" ? mapLiveStatus(live.job.status) : listItem?.status ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{listItem?.title ?? runId}</h2>
          {runStatus ? <StatusBadge status={runStatus} /> : <span className="text-xs text-muted-foreground">상태 불명</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">{runId}</span>
          {live.kind === "job" && (live.job.status === "queued" || live.job.status === "running" || live.job.status === "cancelling") ? (
            <span className="text-xs text-muted-foreground">실시간 갱신 중…</span>
          ) : null}
          {live.kind === "error" ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              실시간 상태 갱신 실패(일시적) — 마지막 확인된 상태를 유지합니다.
            </span>
          ) : null}
          {live.kind === "permission_denied" ? (
            <span className="text-xs text-red-700 dark:text-red-400">
              이 Run의 실시간 상태를 조회할 권한이 없습니다 — 목록에서 확인된 상태를 대신 표시합니다.
            </span>
          ) : null}
          {outOfListScope ? (
            <span className="text-xs text-muted-foreground">
              이 Run은 현재 목록 조회 범위(limit) 밖입니다. stage/quality는 run_id로 직접 조회했습니다.
            </span>
          ) : null}
          {listItem?.startedAt ? <span className="text-xs text-muted-foreground">시작: {formatDateTime(listItem.startedAt)}</span> : null}
          {listItem?.finishedAt ? <span className="text-xs text-muted-foreground">완료: {formatDateTime(listItem.finishedAt)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="text-xs font-medium text-accent-subtle-foreground underline" to={`/builds/${encodeURIComponent(runId)}/edit`}>
            편집
          </Link>
          <Link className="text-xs font-medium text-accent-subtle-foreground underline" to={`/builds/${encodeURIComponent(runId)}/run`}>
            실행
          </Link>
          <Link className="text-xs font-medium text-accent-subtle-foreground underline" to={`/builds/${encodeURIComponent(runId)}/artifacts`}>
            결과물
          </Link>
          <Link className="text-xs font-medium text-accent-subtle-foreground underline" to={`/builds/${encodeURIComponent(runId)}/publish`}>
            게시
          </Link>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={() => {
              seedKubiQuestion(`Run ${runId}의 상태와 실패 원인을 분석해줘.`);
              setShowKubiAnalysis(true);
            }}
          >
            이 Run 분석
          </Button>
        </div>
      </Card>

      {showKubiAnalysis ? (
        <KubiRunAnalysis onClose={() => setShowKubiAnalysis(false)} onAskMore={openKubiDrawer} />
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Pipeline / Stage Progress</h3>
          {stagesState.status === "loaded" ? <MultiSourceOutcomeBadge outcome={outcome} /> : null}
        </div>
        {stagesState.status === "loading" || stagesState.status === "idle" ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : stagesState.status === "error" ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            {stagesState.permissionDenied
              ? "이 Run의 Stage Progress를 조회할 권한이 없습니다."
              : stagesState.error}
          </p>
        ) : sources.length === 0 ? (
          <EmptyState title="Stage 정보가 없습니다" description="이 run에 알려진 source가 없습니다." />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {sources.map((source) => (
              <div key={source.source_key} className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">{source.source_key}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {DATASET_STAGES.map((stage) => (
                    <div key={stage} className="flex items-center gap-2">
                      <span className="text-xs font-medium capitalize text-muted-foreground">{stage}</span>
                      <StageBadge status={source[stage].status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Quality</h3>
          {qualityStatus ? <QualityStateBadge state={qualityStatus} /> : null}
        </div>
        {qualityState.status === "loading" || qualityState.status === "idle" ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : qualityState.status === "error" ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            {qualityState.permissionDenied
              ? "이 Run의 Quality 결과를 조회할 권한이 없습니다."
              : `Quality를 불러오지 못했습니다: ${qualityState.error}`}
          </p>
        ) : qualityState.data.availability === "unavailable" ? (
          <EmptyState title="Quality 결과 없음" description="legacy run이거나 quality가 계산되지 않았습니다(N/A ≠ PASS)." />
        ) : qualityState.data.evaluated_checks === 0 ? (
          <EmptyState title="평가된 check가 없습니다" description="availability는 available이지만 evaluated_checks=0입니다." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {Object.entries(qualityState.data.quality_results).flatMap(([sourceKey, results]) =>
              results.map((result, index) => (
                <li key={`${sourceKey}-${result.rule}-${index}`} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                  <span>
                    {sourceKey} · {result.category}/{result.rule}
                    {result.column ? ` · ${result.column}` : ""}
                  </span>
                  <QualityBadge status={result.status.toUpperCase() as "PASS" | "WARN" | "FAIL"} />
                </li>
              )),
            )}
          </ul>
        )}
      </Card>

      {failureEvidence.length > 0 || qualityFails.length > 0 ? (
        <Card variant="error">
          <h3 className="text-sm font-semibold">Failure evidence</h3>
          {failureEvidence.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {failureEvidence.map((item) => (
                <li key={item.sourceKey}>
                  <strong>{item.sourceKey}</strong> — failed stage: {item.failedStage ?? "unknown"} · last completed stage:{" "}
                  {item.lastCompletedStage ?? "none"}
                </li>
              ))}
            </ul>
          ) : null}
          {listItem?.status === "failed" && live.kind === "job" && live.job.error ? (
            <p className="mt-2 text-sm">Builder error: {live.job.error}</p>
          ) : null}
          {qualityFails.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {qualityFails.map((result, index) => (
                <li key={`${result.source_key}-${result.rule}-${index}`}>
                  FAIL · {result.source_key} · {result.category}/{result.rule}
                  {result.column ? ` · column ${result.column}` : ""} · actual {JSON.stringify(result.actual)} vs threshold{" "}
                  {JSON.stringify(result.threshold)}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Disclosure
          title={
            <span className="flex flex-1 flex-wrap items-center gap-2">
              Run Events{eventsState.status === "loaded" ? ` (${events.length})` : ""}
              {failedEvents.length > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
                  {failedEvents.length}건 실패
                </span>
              ) : null}
            </span>
          }
        >
          <p className="text-xs text-muted-foreground">
            Stage Progress(#488)/Quality(#486)의 판정을 대체하지 않는 append-only evidence입니다.
          </p>
          {eventsState.status === "loading" || eventsState.status === "idle" ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : eventsState.status === "error" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {eventsState.mockUnsupported
                ? eventsState.error
                : eventsState.notFound
                  ? "이 Run의 event timeline을 찾을 수 없습니다(404)."
                  : eventsState.permissionDenied
                    ? "이 Run의 event timeline을 조회할 권한이 없습니다."
                    : `Event timeline을 불러오지 못했습니다: ${eventsState.error}`}
            </p>
          ) : (
            <EventTimeline events={events} />
          )}
        </Disclosure>
      </Card>

      <Card>
        <Disclosure title="BuildSpec snapshot">
          {specState.status === "loading" || specState.status === "idle" ? (
            <Skeleton className="h-10 w-full" />
          ) : null}
          {specState.status === "error" ? (
            <p className="text-sm text-muted-foreground">
              {specState.permissionDenied
                ? "이 Run의 BuildSpec snapshot을 조회할 권한이 없습니다."
                : specState.error}
            </p>
          ) : specState.status === "loaded" ? (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">digest: {specState.data.spec_digest}</p>
              {(() => {
                const datasetId = extractDatasetId(specState.data.spec);
                return datasetId ? (
                  <Link
                    className="mt-2 inline-block text-xs font-medium text-accent-subtle-foreground underline"
                    to={`/datasets/${encodeURIComponent(datasetId)}`}
                  >
                    Dataset 상세 보기 ({datasetId})
                  </Link>
                ) : null;
              })()}
              <p className="mt-2 text-xs text-muted-foreground">
                편집/재실행 연동은 Add Data Workbench(#250)가 main에 merge된 뒤 제공됩니다 — 현재는 snapshot
                조회만 지원합니다.
              </p>
            </div>
          ) : null}
        </Disclosure>
      </Card>
    </div>
  );
}

/** BuildSpec snapshot YAML에서 dataset_id만 안전하게 뽑는다. 파싱 실패는 조용히 null로 처리한다(추측 금지). */
function extractDatasetId(specYaml: string): string | null {
  try {
    const parsed = parseYaml(specYaml) as unknown;
    if (parsed && typeof parsed === "object" && "dataset_id" in parsed) {
      const value = (parsed as Record<string, unknown>).dataset_id;
      return typeof value === "string" && value.length > 0 ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

function mapLiveStatus(status: "queued" | "running" | "cancelling" | "succeeded" | "failed" | "cancelled"): BuildRunStatus {
  if (status === "cancelling") return "running";
  return status;
}

function MultiSourceOutcomeBadge({ outcome }: { outcome: ReturnType<typeof summarizeMultiSourceOutcome> }) {
  if (outcome === "unavailable") return null;
  const meta = {
    all_succeeded: { label: "모든 source 성공", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
    partial: { label: "부분 실패(partial)", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
    all_failed: { label: "모든 source 실패", className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  }[outcome];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>;
}
