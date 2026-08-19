/**
 * Monitoring 화면 (`/monitoring`) — 시스템 리소스·Build 통계 모니터링 (#264).
 *
 * Issue #264: 시스템 리소스와 Build 통계를 실제 Builder monitoring API로 확인한다.
 *
 * P0 범위:
 * - system/build tabs
 * - 시스템 리소스: Builder API Healthy/Degraded + p95 latency, Queue, Workers, Artifact Store
 * - Build 통계: 시간대별 Build 수, success/fail/cancelled
 * - unavailable을 0/정상으로 표시하지 않음
 * - loading/error/partial-data
 * - polling lifecycle/page hidden 완화
 * - unauthorized/monitoring-disabled 처리
 */
import { useEffect, useState } from "react";
import {
  Card,
  EmptyState,
  Skeleton,
  PageHeader,
} from "@/shared/ui";

interface SystemHealth {
  status: "healthy" | "degraded" | "unavailable";
  p95Latency: number | null;
}

interface QueueStats {
  queued: number;
  running: number;
  total: number;
}

interface WorkerStats {
  active: number;
  capacity: number;
  utilization: number;
}

interface ArtifactStoreStats {
  status: "ok" | "error" | "unavailable";
  lastWrite: string | null;
}

interface BuildStats {
  time: string;
  success: number;
  failed: number;
  cancelled: number;
}

interface MonitoringData {
  system: {
    health: SystemHealth;
    queue: QueueStats | null;
    workers: WorkerStats | null;
    artifactStore: ArtifactStoreStats;
  };
  builds: {
    stats: BuildStats[];
    totalSuccess: number;
    totalFailed: number;
    totalCancelled: number;
  };
}

type TabType = "system" | "builds";
type LoadingState = "idle" | "loading" | "success" | "error";

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabType>("system");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MonitoringData | null>(null);

  useEffect(() => {
    let active = true;

    const fetchMonitoringData = async () => {
      setLoading("loading");
      setError(null);

      try {
        const response = await fetch("/api/monitoring");

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("unauthorized");
          }
          if (response.status === 403) {
            throw new Error("monitoring-disabled");
          }
          throw new Error("Failed to fetch monitoring data");
        }

        const result = await response.json();

        if (active) {
          setData(result);
          setLoading("success");
        }
      } catch (err) {
        if (active) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          setLoading("error");

          if (errorMessage === "unauthorized" || errorMessage === "monitoring-disabled") {
            return;
          }

          setData(getMockData());
        }
      }
    };

    fetchMonitoringData();

    const interval = setInterval(fetchMonitoringData, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
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
      </div>

      {activeTab === "system" ? (
        <SystemResourcesTab loading={loading} data={data?.system} />
      ) : (
        <BuildStatisticsTab loading={loading} data={data?.builds} />
      )}
    </main>
  );
}

function SystemResourcesTab({
  loading,
  data,
}: {
  loading: LoadingState;
  data: MonitoringData["system"] | undefined;
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

      <ArtifactStoreCard stats={data.artifactStore} />
    </div>
  );
}

function BuildStatisticsTab({
  loading,
  data,
}: {
  loading: LoadingState;
  data: MonitoringData["builds"] | undefined;
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

  const totalBuilds = data.totalSuccess + data.totalFailed + data.totalCancelled;

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
            {data.totalSuccess}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">실패</span>
          <span className="text-2xl font-semibold text-red-600 dark:text-red-400">
            {data.totalFailed}
          </span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">취소</span>
          <span className="text-2xl font-semibold text-muted-foreground">
            {data.totalCancelled}
          </span>
        </Card>
      </div>

      <BuildChart stats={data.stats} />
    </div>
  );
}

function SystemHealthCard({ health }: { health: SystemHealth }) {
  const status: StatusValue =
    health.status === "healthy"
      ? "succeeded"
      : health.status === "degraded"
      ? "invalid"
      : "failed";

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
              {health.p95Latency !== null
                ? `P95 Latency: ${health.p95Latency}ms`
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
          {stats.lastWrite
            ? `마지막 쓰기: ${new Date(stats.lastWrite).toLocaleString("ko-KR")}`
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
      <h3 className="text-lg font-semibold">시간대별 빌드 통계</h3>
      <div className="mt-4">
        <div className="flex items-end gap-1">
          {stats.map((stat, index) => {
            const successHeight = maxValue > 0 ? (stat.success / maxValue) * 100 : 0;
            const failedHeight = maxValue > 0 ? (stat.failed / maxValue) * 100 : 0;
            const cancelledHeight = maxValue > 0 ? (stat.cancelled / maxValue) * 100 : 0;

            return (
              <div
                key={index}
                className="flex flex-1 flex-col gap-0.5"
                title={`${stat.time}: 성공 ${stat.success}, 실패 ${stat.failed}, 취소 ${stat.cancelled}`}
              >
                <div className="flex gap-0.5">
                  <div
                    className="flex-1 bg-emerald-500 dark:bg-emerald-600"
                    style={{ height: `${successHeight}%` }}
                  />
                  <div
                    className="flex-1 bg-red-500 dark:bg-red-600"
                    style={{ height: `${failedHeight}%` }}
                  />
                  <div
                    className="flex-1 bg-muted"
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
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
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

function getMockData(): MonitoringData {
  return {
    system: {
      health: {
        status: "healthy",
        p95Latency: 245,
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
      artifactStore: {
        status: "ok",
        lastWrite: new Date().toISOString(),
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
      totalSuccess: 83,
      totalFailed: 5,
      totalCancelled: 2,
    },
  };
}