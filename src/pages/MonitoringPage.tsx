/**
 * Monitoring 화면 (`/monitoring`) — 시스템 리소스·Build 통계 모니터링 (#264, #302).
 *
 * Builder #516 실제 계약에 정합한다(#302):
 * - GET /monitoring/summary (시스템) + GET /monitoring/builds?window=24h&bucket=hour (통계)
 * - availability 어휘: available/partial/unavailable — null/측정불가를 0/정상으로
 *   표시하지 않는다(#516 원칙).
 * - 실연동 모드에서 오류가 나면 mock으로 대체하지 않는다(정상 오인 방지, #302).
 * - 401/403은 "권한 없음" 상태로 구분한다(ApiError.status 기반).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  EmptyState,
  Skeleton,
  PageHeader,
  Button,
  LinkButton,
} from "@/shared/ui";
import { ApiError, builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type {
  MonitoringApiStatus,
  MonitoringArtifactStoreStats,
  MonitoringBucket,
  MonitoringQueueStats,
  MonitoringRecentRun,
  MonitoringWorkerStats,
  MonitoringSummaryResponse,
  MonitoringBuildsResponse,
} from "@/shared/lib/builderApi.schema";

type TabType = "system" | "builds" | "recent-runs";

type LoadingState = "idle" | "loading" | "success" | "error";

interface MonitoringData {
  summary: MonitoringSummaryResponse;
  builds: MonitoringBuildsResponse;
}

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabType>("system");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [unauthorized, setUnauthorized] = useState(false);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    if (!isPageVisible) return;

    setLoading("loading");

    if (!isRealBuilderEnabled()) {
      const mock = getMockData();
      setData(mock);
      setLoading("success");
      setLastRefreshTime(new Date());
      return;
    }

    try {
      const [summary, builds] = await Promise.all([
        builderApi.getMonitoringSummary(),
        builderApi.getMonitoringBuilds(),
      ]);
      setData({ summary, builds });
      setLoading("success");
      setLastRefreshTime(new Date());

      if (
        previousStatusRef.current &&
        previousStatusRef.current !== summary.status
      ) {
        if (summary.status === "degraded") {
          console.warn("Builder 시스템 상태 저하 감지됨");
        }
      }
      previousStatusRef.current = summary.status;
    } catch (err) {
      // 401/403은 인증/인가 문제로 구분해 안내한다 — 실API 응답 기준(#302).
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUnauthorized(true);
        setLoading("error");
        return;
      }
      setLoading("error");
    }
  }, [isPageVisible]);

  useEffect(() => {
    fetchMonitoringData();

    if (autoRefresh && isPageVisible) {
      intervalRef.current = setInterval(fetchMonitoringData, 30000);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchMonitoringData, autoRefresh, isPageVisible]);

  useEffect(() => {
    const onVisibilityChange = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const toggleAutoRefresh = () => setAutoRefresh((prev) => !prev);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  if (unauthorized) {
    return (
      <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <PageHeader
          eyebrow="Monitoring"
          title="시스템 모니터링"
          description="실행 이력과 시스템 리소스 상태를 실시간으로 확인합니다."
        />
        <Card variant="error">
          <p className="font-semibold">권한이 없습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            모니터링 데이터를 조회하려면 로그인이 필요합니다.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Monitoring"
        title="시스템 모니터링"
        description="실행 이력과 시스템 리소스 상태를 실시간으로 확인합니다."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {lastRefreshTime
                ? `마지막 업데이트: ${lastRefreshTime.toLocaleTimeString("ko-KR")}`
                : "데이터 로드 중..."}
            </span>
            <Button
              variant={autoRefresh ? "primary" : "secondary"}
              size="sm"
              onClick={toggleAutoRefresh}
              type="button"
            >
              {autoRefresh ? "자동 새로고침 ON" : "자동 새로고침 OFF"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchMonitoringData()}
              type="button"
            >
              새로고침
            </Button>
          </div>
        }
      />

      {data?.summary.status === "degraded" && (
        <Card variant="error">
          <p className="font-semibold">시스템 상태 저하</p>
          <p className="mt-2 text-sm text-muted-foreground">
            일부 하위 시스템이 partial/unavailable 상태입니다. 각 카드의 상태 배지를 확인하세요.
          </p>
        </Card>
      )}

      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "system"
              ? "border-b-2 border-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("system")}
          type="button"
        >
          System Resources
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "builds"
              ? "border-b-2 border-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("builds")}
          type="button"
        >
          Build Statistics
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "recent-runs"
              ? "border-b-2 border-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("recent-runs")}
          type="button"
        >
          Recent Runs
        </button>
      </div>

      {activeTab === "system" ? (
        <SystemResourcesTab loading={loading} summary={data?.summary} />
      ) : activeTab === "builds" ? (
        <BuildStatisticsTab loading={loading} builds={data?.builds} />
      ) : (
        <RecentRunsTab loading={loading} runs={data?.builds?.recent_runs} />
      )}
    </main>
  );
}

function SystemResourcesTab({
  loading,
  summary,
}: {
  loading: LoadingState;
  summary: MonitoringSummaryResponse | undefined;
}) {
  if (loading === "error") {
    return (
      <Card variant="error">
        <p className="font-semibold">데이터를 가져올 수 없습니다</p>
        <p className="mt-2 text-sm text-muted-foreground">
          잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  if (loading === "loading" || !summary) {
    return <SystemResourcesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <SystemHealthCard status={summary.status} api={summary.api} />

      <div className="grid gap-6 lg:grid-cols-2">
        <QueueStatsCard stats={summary.queue} />
        <WorkerStatsCard stats={summary.workers} />
      </div>

      <ArtifactStoreCard stats={summary.artifact_store} />
    </div>
  );
}

function BuildStatisticsTab({
  loading,
  builds,
}: {
  loading: LoadingState;
  builds: MonitoringBuildsResponse | undefined;
}) {
  if (loading === "error") {
    return (
      <Card variant="error">
        <p className="font-semibold">데이터를 가져올 수 없습니다</p>
        <p className="mt-2 text-sm text-muted-foreground">
          잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  if (loading === "loading" || !builds) {
    return <BuildStatisticsSkeleton />;
  }

  // builder는 총계를 내려주지 않는다(#516) — bucket 합으로 화면에서 계산한다.
  const totals = builds.buckets.reduce(
    (acc, bucket) => ({
      success: acc.success + bucket.success,
      failed: acc.failed + bucket.failed,
      cancelled: acc.cancelled + bucket.cancelled,
    }),
    { success: 0, failed: 0, cancelled: 0 },
  );
  const totalBuilds = totals.success + totals.failed + totals.cancelled;

  if (totalBuilds === 0 && builds.recent_runs.length === 0) {
    return (
      <Card>
        <EmptyState
          title="빌드 기록이 없습니다"
          description="아직 빌드가 실행되지 않았습니다."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">성공</span>
          <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {totals.success}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">실패</span>
          <span className="text-2xl font-semibold text-red-600 dark:text-red-400">
            {totals.failed}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">취소</span>
          <span className="text-2xl font-semibold text-muted-foreground">
            {totals.cancelled}
          </span>
        </Card>
      </div>

      {builds.availability === "partial" && (
        <Card variant="error">
          <p className="text-sm text-muted-foreground">
            일부 run이 권한 제한으로 집계에서 제외되었습니다 (제외 {builds.excluded_count}건).
          </p>
        </Card>
      )}

      <BuildChart buckets={builds.buckets} />
    </div>
  );
}

function SystemHealthCard({
  status,
  api,
}: {
  status: MonitoringSummaryResponse["status"];
  api: MonitoringApiStatus;
}) {
  // aggregate는 healthy/degraded 2값이고, api 자체 측정 불가는 availability가 알려준다.
  const statusLabel =
    api.availability === "unavailable"
      ? "사용 불가"
      : status === "degraded"
      ? "성능 저하"
      : "정상";

  const statusColor =
    api.availability === "unavailable"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : status === "degraded"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Builder API</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              {api.p95_latency_ms !== null
                ? `P95 Latency: ${api.p95_latency_ms}ms`
                : "Latency: 측정 불가"}
            </span>
            {api.sample_count === null && (
              <span className="text-sm text-muted-foreground">· 표본 없음</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** 측정값이 null(측정 불가)이면 0 대신 "—"로 표시한다(#516/#302 원칙). */
function measured(value: number | null): string {
  return value === null ? "—" : String(value);
}

function QueueStatsCard({ stats }: { stats: MonitoringQueueStats }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold">Queue</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {stats.availability === "unavailable" ? "측정 불가" : "측정 중"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">대기 중</span>
          <span className="text-lg font-semibold">{measured(stats.waiting)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">실행 중</span>
          <span className="text-lg font-semibold">{measured(stats.running)}</span>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">전체</span>
            <span className="text-xl font-bold">{measured(stats.total)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WorkerStatsCard({ stats }: { stats: MonitoringWorkerStats }) {
  const utilizationPercent = Math.round(stats.utilization * 100);

  return (
    <Card>
      <h3 className="text-lg font-semibold">Workers</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {stats.availability === "unavailable" ? "측정 불가" : "측정 중"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">활성</span>
          <span className="text-lg font-semibold">{stats.active}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">용량</span>
          <span className="text-lg font-semibold">{stats.capacity}</span>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">활용률</span>
            <span className="text-xl font-bold">{utilizationPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-accent transition-all"
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ArtifactStoreCard({ stats }: { stats: MonitoringArtifactStoreStats }) {
  const statusLabel =
    stats.availability === "available"
      ? "정상"
      : stats.availability === "partial"
      ? "부분 가용"
      : "사용 불가";

  const statusColor =
    stats.availability === "available"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : stats.availability === "partial"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";

  return (
    <Card>
      <h3 className="text-lg font-semibold">Artifact Store</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="text-sm text-muted-foreground">
          {stats.last_write_at
            ? `마지막 쓰기: ${new Date(stats.last_write_at).toLocaleString("ko-KR")}`
            : "마지막 쓰기: 없음"}
        </span>
      </div>
    </Card>
  );
}

function BuildChart({ buckets }: { buckets: MonitoringBucket[] }) {
  if (buckets.length === 0) {
    return (
      <Card>
        <EmptyState
          title="데이터가 없습니다"
          description="시간대별 빌드 통계를 표시할 데이터가 없습니다."
        />
      </Card>
    );
  }

  const maxValue = Math.max(
    ...buckets.map((b) => Math.max(b.success, b.failed, b.cancelled))
  );

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">시간대별 빌드 통계</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 bg-emerald-500 dark:bg-emerald-600" />
            <span>성공</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 bg-red-500 dark:bg-red-600" />
            <span>실패</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 bg-muted" />
            <span>취소</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-end gap-2 min-h-[200px]">
          {buckets.map((bucket, index) => {
            const successHeight = maxValue > 0 ? (bucket.success / maxValue) * 100 : 0;
            const failedHeight = maxValue > 0 ? (bucket.failed / maxValue) * 100 : 0;
            const cancelledHeight = maxValue > 0 ? (bucket.cancelled / maxValue) * 100 : 0;
            const label = bucket.bucket_start.slice(11, 16) || bucket.bucket_start;

            return (
              <div
                key={index}
                className="flex flex-1 flex-col gap-0.5 group"
                title={`${bucket.bucket_start}: 성공 ${bucket.success}, 실패 ${bucket.failed}, 취소 ${bucket.cancelled}`}
              >
                <div className="flex gap-0.5 items-end h-[180px] bg-muted/30 rounded-t relative">
                  <div
                    className="flex-1 bg-emerald-500 dark:bg-emerald-600 transition-all duration-300 hover:bg-emerald-400 dark:hover:bg-emerald-500 rounded-b-sm"
                    style={{ height: `${successHeight}%` }}
                  />
                  <div
                    className="flex-1 bg-red-500 dark:bg-red-600 transition-all duration-300 hover:bg-red-400 dark:hover:bg-red-500 rounded-b-sm"
                    style={{ height: `${failedHeight}%` }}
                  />
                  <div
                    className="flex-1 bg-muted transition-all duration-300 hover:bg-muted-foreground/20 rounded-b-sm"
                    style={{ height: `${cancelledHeight}%` }}
                  />
                </div>
                <span className="text-[10px] text-center text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/** BuildIndex 내부 상태 값(ok/failed/cancelled 등)을 표시 라벨로 매핑한다. */
function runStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "ok":
    case "succeeded":
      return {
        label: "성공",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
      };
    case "failed":
      return {
        label: "실패",
        className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
      };
    case "running":
      return {
        label: "실행 중",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
      };
    case "cancelled":
      return {
        label: "취소됨",
        className: "bg-muted text-muted-foreground",
      };
    case "queued":
      return {
        label: "대기 중",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
      };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

/** started/finished 타임스탬프로 소요 시간(초)을 계산한다 — builder는 duration을 내려주지 않는다. */
function runDurationSeconds(run: MonitoringRecentRun): number | null {
  if (run.started_at === null || run.finished_at === null) return null;
  const duration =
    (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000;
  return Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null;
}

function RecentRunsTab({
  loading,
  runs,
}: {
  loading: LoadingState;
  runs: MonitoringRecentRun[] | undefined;
}) {
  if (loading === "error") {
    return (
      <Card variant="error">
        <p className="font-semibold">데이터를 가져올 수 없습니다</p>
        <p className="mt-2 text-sm text-muted-foreground">
          잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  if (loading === "loading" || runs === undefined) {
    return <RecentRunsSkeleton />;
  }

  if (runs.length === 0) {
    return (
      <Card>
        <EmptyState
          title="최근 실행 이력이 없습니다"
          description="아직 빌드가 실행되지 않았습니다."
          actionLabel="새 빌드 만들기"
          actionHref="/builds/new"
        />
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">최근 빌드 실행</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          최근 실행된 빌드들의 상태와 결과를 확인할 수 있습니다.
        </p>
      </div>
      <ul>
        {runs.map((run) => {
          const status = runStatusLabel(run.status);
          const duration = runDurationSeconds(run);
          return (
            <li
              key={run.run_id}
              className="grid grid-cols-[1fr_0.8fr_0.8fr_0.6fr_0.6fr] items-center gap-4 border-b border-border px-6 py-4 text-sm last:border-0 hover:bg-muted/50 transition-colors"
            >
              <div>
                <span className="font-medium">{run.run_id}</span>
              </div>
              <div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="text-muted-foreground">
                {run.started_at ? new Date(run.started_at).toLocaleString("ko-KR") : "—"}
              </div>
              <div className="text-muted-foreground">
                {duration !== null ? `${duration}초` : "—"}
              </div>
              <div className="text-right">
                <LinkButton variant="secondary" size="sm" to={`/builds/${run.run_id}`}>
                  보기
                </LinkButton>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SystemResourcesSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Skeleton className="h-6 w-16" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
        <Card>
          <Skeleton className="h-6 w-16" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>
      <Card>
        <Skeleton className="h-6 w-32" />
        <div className="mt-2">
          <Skeleton className="h-5 w-48" />
        </div>
      </Card>
    </div>
  );
}

function BuildStatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-2 h-8 w-16" />
        </Card>
        <Card>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-2 h-8 w-16" />
        </Card>
        <Card>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-2 h-8 w-16" />
        </Card>
      </div>
      <Card>
        <Skeleton className="h-6 w-48" />
        <div className="mt-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </Card>
    </div>
  );
}

function RecentRunsSkeleton() {
  return (
    <Card className="p-0">
      <div className="p-6 border-b border-border">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_0.8fr_0.8fr_0.6fr_0.6fr] items-center gap-4 py-3"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** mock 모드 fixture — Builder 실제 wire 계약(/monitoring/summary + /monitoring/builds)과 동일 형상. */
function getMockData(): MonitoringData {
  const now = Date.now();
  const hourAgo = (hours: number) => new Date(now - hours * 3600000).toISOString();

  const summary: MonitoringSummaryResponse = {
    generated_at: new Date(now).toISOString(),
    status: "healthy",
    api: { availability: "available", sample_count: 128, p95_latency_ms: 245 },
    queue: { availability: "available", waiting: 3, running: 2, total: 5 },
    workers: { availability: "available", active: 2, capacity: 4, utilization: 0.5 },
    artifact_store: {
      availability: "available",
      last_write_at: new Date(now).toISOString(),
    },
  };

  const buckets: MonitoringBucket[] = [0, 4, 8, 12, 16, 20].map((hour, index) => {
    const success = [12, 8, 15, 20, 18, 10][index];
    const failed = [1, 0, 2, 1, 0, 1][index];
    const cancelled = [0, 1, 0, 0, 0, 1][index];
    return {
      bucket_start: `2026-01-01T${String(hour).padStart(2, "0")}:00:00+00:00`,
      bucket_end: `2026-01-01T${String(hour + 1).padStart(2, "0")}:00:00+00:00`,
      total: success + failed + cancelled,
      success,
      failed,
      cancelled,
    };
  });

  const builds: MonitoringBuildsResponse = {
    window: "24h",
    bucket: "hour",
    availability: "available",
    excluded_count: 0,
    buckets,
    recent_runs: [
      {
        run_id: "run-001",
        status: "ok",
        started_at: hourAgo(1),
        finished_at: hourAgo(0.5),
      },
      {
        run_id: "run-002",
        status: "failed",
        started_at: hourAgo(2),
        finished_at: hourAgo(1.6),
      },
      {
        run_id: "run-003",
        status: "running",
        started_at: hourAgo(0.2),
        finished_at: null,
      },
      {
        run_id: "run-004",
        status: "cancelled",
        started_at: hourAgo(3),
        finished_at: hourAgo(2.7),
      },
    ],
  };

  return { summary, builds };
}
