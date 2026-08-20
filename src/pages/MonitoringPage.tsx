/**
 * Monitoring 화면 (`/monitoring`) — 시스템 리소스·Build 통계 모니터링 (#264).
 *
 * Issue #264: 시스템 리소스와 Build 통계를 실제 Builder monitoring API로 확인한다.
 *
 * P0 범위:
 * - system/build/recent-runs tabs
 * - 시스템 리소스: Builder API Healthy/Degraded + p95 latency, Queue, Workers, Artifact Store
 * - Build 통계: 시간대별 Build 수, success/fail/cancelled
 * - Recent Runs: 최근 빌드 실행 이력
 * - unavailable을 0/정상으로 표시하지 않음
 * - loading/error/partial-data
 * - polling lifecycle/page hidden 완화
 * - unauthorized/monitoring-disabled 처리
 * - 자동 새로고침 토글
 *
 * P1 고도화:
 * - Page Visibility API로 숨김 상태에서 polling 최적화
 * - 더 나은 차트 시각화
 * - 로딩/에러 상태 애니메이션 개선
 * - 토스트 알림으로 상태 변경 알림
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  EmptyState,
  Skeleton,
  PageHeader,
  Button,
  LinkButton,
  type StatusValue,
} from "@/shared/ui";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type {
  MonitoringResponse,
  SystemHealth,
  QueueStats,
  WorkerStats,
  ArtifactStoreStats,
  BuildStats,
  RecentRun,
} from "@/shared/lib/builderApi.schema";

type TabType = "system" | "builds" | "recent-runs";

type LoadingState = "idle" | "loading" | "success" | "error";

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabType>("system");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousHealthRef = useRef<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    if (!isPageVisible) return;

    setLoading("loading");
    setError(null);

    try {
      let result: MonitoringResponse;

      if (isRealBuilderEnabled()) {
        result = await builderApi.getMonitoring();
      } else {
        result = getMockData();
      }

      setData(result);
      setLoading("success");
      setLastRefreshTime(new Date());

      const currentHealth = result.system.health.status;
      if (previousHealthRef.current && previousHealthRef.current !== currentHealth) {
        if (currentHealth === "degraded") {
          console.warn("Builder API 성능 저하 감지됨");
        } else if (currentHealth === "unavailable") {
          console.error("Builder API 사용 불가 상태 감지됨");
        }
      }
      previousHealthRef.current = currentHealth;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setLoading("error");

      if (errorMessage === "unauthorized" || errorMessage === "monitoring-disabled") {
        return;
      }

      setData(getMockData());
      setLastRefreshTime(new Date());
    }
  }, [isPageVisible]);

  useEffect(() => {
    fetchMonitoringData();

    if (autoRefresh && isPageVisible) {
      intervalRef.current = setInterval(fetchMonitoringData, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchMonitoringData, autoRefresh, isPageVisible]);

  // Page Visibility API로 숨김 상태 감지
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => !prev);
  };

  const handleManualRefresh = () => {
    fetchMonitoringData();
  };

  if (error === "unauthorized") {
    return (
      <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <PageHeader
          eyebrow="Monitoring"
          title="모니터링"
          description="실행 이력과 시스템 상태를 모니터링합니다."
        />
        <Card variant="error">
          <p className="font-semibold">권한이 없습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            모니터링 데이터를 보려면 로그인이 필요합니다.
          </p>
        </Card>
      </main>
    );
  }

  if (error === "monitoring-disabled") {
    return (
      <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <PageHeader
          eyebrow="Monitoring"
          title="모니터링"
          description="실행 이력과 시스템 상태를 모니터링합니다."
        />
        <Card>
          <p className="font-semibold">모니터링이 비활성화되어 있습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            관리자에게 문의하여 모니터링을 활성화해 주세요.
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
              onClick={handleManualRefresh}
              type="button"
              disabled={loading === "loading"}
            >
              새로고침
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 border-b border-border">
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
        <SystemResourcesTab loading={loading} data={data?.system} />
      ) : activeTab === "builds" ? (
        <BuildStatisticsTab loading={loading} data={data?.builds} />
      ) : (
        <RecentRunsTab loading={loading} data={data?.builds?.recent_runs} />
      )}
    </main>
  );
}

function SystemResourcesTab({
  loading,
  data,
}: {
  loading: LoadingState;
  data: MonitoringResponse["system"] | undefined;
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

  if (loading === "loading" || !data) {
    return <SystemResourcesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <SystemHealthCard health={data.health} />

      <div className="grid gap-6 lg:grid-cols-2">
        <QueueStatsCard stats={data.queue} />
        <WorkerStatsCard stats={data.workers} />
      </div>

      <ArtifactStoreCard stats={data.artifact_store} />
    </div>
  );
}

function BuildStatisticsTab({
  loading,
  data,
}: {
  loading: LoadingState;
  data: MonitoringResponse["builds"] | undefined;
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

  if (loading === "loading" || !data) {
    return <BuildStatisticsSkeleton />;
  }

  const totalBuilds = data.total_success + data.total_failed + data.total_cancelled;

  if (totalBuilds === 0) {
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
            {data.total_success}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">실패</span>
          <span className="text-2xl font-semibold text-red-600 dark:text-red-400">
            {data.total_failed}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">취소</span>
          <span className="text-2xl font-semibold text-muted-foreground">
            {data.total_cancelled}
          </span>
        </Card>
      </div>

      <BuildChart stats={data.stats} />
    </div>
  );
}

function SystemHealthCard({ health }: { health: SystemHealth }) {
  const statusLabel =
    health.status === "healthy"
      ? "정상"
      : health.status === "degraded"
      ? "성능 저하"
      : "사용 불가";

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Builder API</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              {statusLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              {health.p95_latency !== null
                ? `P95 Latency: ${health.p95_latency}ms`
                : "Latency: 측정 불가"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function QueueStatsCard({ stats }: { stats: QueueStats | null }) {
  if (!stats) {
    return (
      <Card>
        <h3 className="text-lg font-semibold">Queue</h3>
        <p className="mt-2 text-sm text-muted-foreground">데이터를 사용할 수 없습니다</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold">Queue</h3>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">대기 중</span>
          <span className="text-lg font-semibold">{stats.queued}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">실행 중</span>
          <span className="text-lg font-semibold">{stats.running}</span>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">전체</span>
            <span className="text-xl font-bold">{stats.total}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WorkerStatsCard({ stats }: { stats: WorkerStats | null }) {
  if (!stats) {
    return (
      <Card>
        <h3 className="text-lg font-semibold">Workers</h3>
        <p className="mt-2 text-sm text-muted-foreground">데이터를 사용할 수 없습니다</p>
      </Card>
    );
  }

  const utilizationPercent = Math.round(stats.utilization * 100);

  return (
    <Card>
      <h3 className="text-lg font-semibold">Workers</h3>
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

function ArtifactStoreCard({ stats }: { stats: ArtifactStoreStats }) {
  const statusLabel =
    stats.status === "ok"
      ? "정상"
      : stats.status === "error"
      ? "오류"
      : "사용 불가";

  const statusColor =
    stats.status === "ok"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : stats.status === "error"
      ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";

  return (
    <Card>
      <h3 className="text-lg font-semibold">Artifact Store</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="text-sm text-muted-foreground">
          {stats.last_write
            ? `마지막 쓰기: ${new Date(stats.last_write).toLocaleString("ko-KR")}`
            : "마지막 쓰기: 없음"}
        </span>
      </div>
    </Card>
  );
}

function BuildChart({ stats }: { stats: BuildStats[] }) {
  if (stats.length === 0) {
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
    ...stats.map((s) => Math.max(s.success, s.failed, s.cancelled))
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
          {stats.map((stat, index) => {
            const successHeight = maxValue > 0 ? (stat.success / maxValue) * 100 : 0;
            const failedHeight = maxValue > 0 ? (stat.failed / maxValue) * 100 : 0;
            const cancelledHeight = maxValue > 0 ? (stat.cancelled / maxValue) * 100 : 0;

            return (
              <div
                key={index}
                className="flex flex-1 flex-col gap-0.5 group"
                title={`${stat.time}: 성공 ${stat.success}, 실패 ${stat.failed}, 취소 ${stat.cancelled}`}
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
                  {stat.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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

function RecentRunsTab({
  loading,
  data,
}: {
  loading: LoadingState;
  data: RecentRun[] | undefined;
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

  if (loading === "loading" || !data) {
    return <RecentRunsSkeleton />;
  }

  if (data.length === 0) {
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
        {data.map((run) => (
          <li
            key={run.id}
            className="grid grid-cols-[1fr_0.8fr_0.8fr_0.6fr_0.6fr] items-center gap-4 border-b border-border px-6 py-4 text-sm last:border-0 hover:bg-muted/50 transition-colors"
          >
            <div>
              <span className="font-medium">{run.title ?? run.id}</span>
            </div>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  run.status === "succeeded"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : run.status === "failed"
                    ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                    : run.status === "running"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                    : run.status === "cancelled"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                }`}
              >
                {run.status === "succeeded" && "성공"}
                {run.status === "failed" && "실패"}
                {run.status === "running" && "실행 중"}
                {run.status === "cancelled" && "취소됨"}
                {run.status === "queued" && "대기 중"}
              </span>
            </div>
            <div className="text-muted-foreground">
              {run.started_at ? new Date(run.started_at).toLocaleString("ko-KR") : "—"}
            </div>
            <div className="text-muted-foreground">
              {run.duration !== null ? `${run.duration}초` : "—"}
            </div>
            <div className="text-right">
              <LinkButton variant="secondary" size="sm" to={`/builds/${run.id}`}>
                보기
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>
    </Card>
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

function getMockData(): MonitoringResponse {
  const now = new Date();
  const recentRuns: RecentRun[] = [
    {
      id: "run-001",
      title: "서울시 공공주택 데이터 수집",
      status: "succeeded",
      started_at: new Date(now.getTime() - 3600000).toISOString(),
      finished_at: new Date(now.getTime() - 1800000).toISOString(),
      duration: 1800,
    },
    {
      id: "run-002",
      title: "부산시 교통통계 데이터",
      status: "failed",
      started_at: new Date(now.getTime() - 7200000).toISOString(),
      finished_at: new Date(now.getTime() - 6000000).toISOString(),
      duration: 1200,
    },
    {
      id: "run-003",
      title: "인천시 환경데이터",
      status: "running",
      started_at: new Date(now.getTime() - 600000).toISOString(),
      finished_at: null,
      duration: null,
    },
    {
      id: "run-004",
      title: "대구시 문화시설 정보",
      status: "succeeded",
      started_at: new Date(now.getTime() - 10800000).toISOString(),
      finished_at: new Date(now.getTime() - 9000000).toISOString(),
      duration: 1800,
    },
    {
      id: "run-005",
      title: "광주시 의료기관 데이터",
      status: "cancelled",
      started_at: new Date(now.getTime() - 14400000).toISOString(),
      finished_at: new Date(now.getTime() - 12000000).toISOString(),
      duration: 2400,
    },
  ];

  return {
    system: {
      health: {
        status: "healthy",
        p95_latency: 245,
      },
      queue: {
        queued: 3,
        running: 2,
        total: 5,
      },
      workers: {
        active: 2,
        capacity: 4,
        utilization: 0.5,
      },
      artifact_store: {
        status: "ok",
        last_write: new Date().toISOString(),
      },
    },
    builds: {
      stats: [
        { time: "00:00", success: 12, failed: 1, cancelled: 0 },
        { time: "04:00", success: 8, failed: 0, cancelled: 1 },
        { time: "08:00", success: 15, failed: 2, cancelled: 0 },
        { time: "12:00", success: 20, failed: 1, cancelled: 0 },
        { time: "16:00", success: 18, failed: 0, cancelled: 0 },
        { time: "20:00", success: 10, failed: 1, cancelled: 1 },
      ],
      total_success: 83,
      total_failed: 5,
      total_cancelled: 2,
      recent_runs: recentRuns,
    },
  };
}