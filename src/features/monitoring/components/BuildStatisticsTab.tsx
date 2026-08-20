/**
 * Build Statistics 탭 (#264, #303) — bucket 합산 총계와 시간대별 차트.
 * builder는 총계를 내려주지 않는다(#516) — bucket 합으로 화면에서 계산한다.
 */
import { Card, EmptyState, Skeleton } from "@/shared/ui";
import type {
  MonitoringBucket,
  MonitoringBuildsResponse,
} from "@/shared/lib/builderApi.schema";
import type { MonitoringLoadingState } from "@/features/monitoring/model";

export function BuildStatisticsTab({
  loading,
  builds,
}: {
  loading: MonitoringLoadingState;
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
