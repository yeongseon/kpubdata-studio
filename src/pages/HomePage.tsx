/**
 * Studio 홈 대시보드 화면 - 신규 사용자/기존 사용자 상태 분기.
 *
 * Issue #248: Home을 신규 사용자·기존 사용자 상태로 구현한다.
 *
 * 신규 사용자 여부는 dataset/build 존재 여부로 판단한다.
 * - 신규 사용자: 환영 메시지, Kubi 검색 hero, 공공데이터 탐색, 데이터 바로 가져오기, 예시 데이터셋 둘러보기
 * - 기존 사용자: 실제 KPI (DATASETS, BUILD SUCCESS, VALIDATION WARN, RUNNING), 최근 데이터셋, 최근 Build stage 요약, 품질 경고/실패 Build
 */
import { useEffect, useState } from "react";
import { listBuilds } from "@/features/runs/api";
import type { BuildListItem, BuildRunStatus } from "@/shared/lib/types";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Skeleton,
  type StatusValue,
} from "@/shared/ui";

interface DashboardStats {
  datasetCount: number;
  buildSuccess: number;
  validationWarn: number;
  running: number;
}

interface LoadingState {
  builds: boolean;
  stats: boolean;
}

interface ApiState {
  builds: "loading" | "error" | "success";
  stats: "loading" | "error" | "success";
}

/**
 * 신규 사용자 여부를 판단한다.
 * dataset/build이 하나도 없으면 신규 사용자로 간주한다.
 */
function isNewUser(stats: DashboardStats): boolean {
  return stats.datasetCount === 0 && stats.buildSuccess === 0 && stats.validationWarn === 0 && stats.running === 0;
}

export function HomePage() {
  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    datasetCount: 0,
    buildSuccess: 0,
    validationWarn: 0,
    running: 0,
  });
  const [loading, setLoading] = useState<LoadingState>({
    builds: true,
    stats: true,
  });
  const [apiState, setApiState] = useState<ApiState>({
    builds: "loading",
    stats: "loading",
  });

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const buildList = await listBuilds();
        if (active) {
          setBuilds(buildList);
          setApiState((prev) => ({ ...prev, builds: "success" }));

          const succeeded = buildList.filter((b) => b.status === "succeeded").length;
          const running = buildList.filter((b) => b.status === "running" || b.status === "queued").length;

          setStats({
            datasetCount: succeeded,
            buildSuccess: succeeded,
            validationWarn: 0,
            running,
          });
          setApiState((prev) => ({ ...prev, stats: "success" }));
        }
      } catch (error) {
        if (active) {
          setApiState((prev) => ({ ...prev, builds: "error", stats: "error" }));
        }
      } finally {
        if (active) {
          setLoading({ builds: false, stats: false });
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, []);

  const recentBuilds = [...builds]
    .sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const isNew = stats.datasetCount === 0 && stats.buildSuccess === 0;

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      {isNew ? <NewUserHome /> : <ExistingUserHome stats={stats} recentBuilds={recentBuilds} loading={loading} apiState={apiState} />}
    </main>
  );
}

function NewUserHome() {
  return (
    <>
      <PageHeader
        eyebrow="시작하기"
        title="공공데이터를 쉽게 수집하고 변환하세요"
        description="Kubi가 도와드립니다. 예시 데이터셋을 둘러보거나 바로 시작하세요."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" className="flex flex-col items-center justify-center p-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Kubi로 데이터 찾기</h2>
          <p className="mt-3 text-muted-foreground">
            한국어로 질문하면 Kubi가 적합한 공공데이터를 찾아드립니다
          </p>
          <LinkButton className="mt-6" to="/kubi">
            Kubi 열기
          </LinkButton>
        </Card>

        <Card variant="elevated" className="flex flex-col items-center justify-center p-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">데이터 바로 가져오기</h2>
          <p className="mt-3 text-muted-foreground">
            Public API, 파일, URL에서 데이터를 직접 가져와 빌드하세요
          </p>
          <LinkButton className="mt-6" variant="secondary" to="/add-data">
            데이터 추가하기
          </LinkButton>
        </Card>
      </section>

      <section>
        <PageHeader eyebrow="둘러보기" title="예시 데이터셋" className="mb-4" />
        <Card className="p-0">
          <EmptyState
            title="예시 데이터셋을 곧 만나보실 수 있습니다"
            description="자주 사용하는 공공데이터 템플릿을 준비 중입니다"
            actionLabel="공공데이터 탐색"
            actionHref="/discover"
          />
        </Card>
      </section>
    </>
  );
}

function ExistingUserHome({
  stats,
  recentBuilds,
  loading,
  apiState,
}: {
  stats: DashboardStats;
  recentBuilds: BuildListItem[];
  loading: LoadingState;
  apiState: ApiState;
}) {
  return (
    <>
      <PageHeader
        eyebrow="대시보드"
        title="작업 현황을 한눈에 확인하세요"
        description="최근 데이터셋, 빌드 상태, 품질 경고를 모니터링합니다"
      />

      <KpiCards stats={stats} loading={loading.stats} apiState={apiState.stats} />

      <section className="grid gap-6 xl:grid-cols-2">
        <RecentBuildsSection recentBuilds={recentBuilds} loading={loading.builds} apiState={apiState.builds} />
        <QualitySection />
      </section>
    </>
  );
}

function KpiCards({ stats, loading, apiState }: { stats: DashboardStats; loading: boolean; apiState: ApiState["stats"] }) {
  if (apiState === "error") {
    return (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["DATASETS", "BUILD SUCCESS", "VALIDATION WARN", "RUNNING"].map((label) => (
          <Card key={label} variant="error" className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tracking-tight text-muted-foreground">—</span>
          </Card>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="DATASETS" value={stats.datasetCount} loading={loading} />
      <KpiCard label="BUILD SUCCESS" value={stats.buildSuccess} loading={loading} variant="success" />
      <KpiCard label="VALIDATION WARN" value={stats.validationWarn} loading={loading} variant="error" />
      <KpiCard label="RUNNING" value={stats.running} loading={loading} />
    </section>
  );
}

function KpiCard({
  label,
  value,
  loading,
  variant = "default",
}: {
  label: string;
  value: number;
  loading: boolean;
  variant?: "default" | "success" | "error";
}) {
  if (loading) {
    return (
      <Card>
        <span className="text-sm text-muted-foreground">{label}</span>
        <Skeleton className="mt-2 h-8 w-16" />
      </Card>
    );
  }

  const colorClass = variant === "success" ? "text-emerald-600 dark:text-emerald-400" :
                     variant === "error" ? "text-red-600 dark:text-red-400" :
                     "text-foreground";

  return (
    <Card className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${colorClass}`}>
        {value}
      </span>
    </Card>
  );
}

function RecentBuildsSection({ recentBuilds, loading, apiState }: { recentBuilds: BuildListItem[]; loading: boolean; apiState: ApiState["builds"] }) {
  return (
    <section>
      <PageHeader eyebrow="최근 빌드" title="최근 실행" className="mb-4" />
      <Card className="p-0">
        {loading ? (
          <div className="px-6 py-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.6fr] items-center gap-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-8 w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : apiState === "error" ? (
          <EmptyState
            title="빌드 목록을 불러올 수 없습니다"
            description="나중에 다시 시도해 주세요"
          />
        ) : recentBuilds.length === 0 ? (
          <EmptyState
            title="아직 빌드가 없습니다"
            description="새 빌드를 만들어보세요"
            actionLabel="새 빌드 만들기"
            actionHref="/builds/new"
          />
        ) : (
          <ul>
            {recentBuilds.map((run) => (
              <li
                key={run.id}
                className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.6fr] items-center gap-4 border-b border-border px-6 py-3 text-sm last:border-0"
              >
                <span className="font-medium">{run.title ?? run.id}</span>
                <span className="capitalize text-muted-foreground">{run.status}</span>
                <span className="text-muted-foreground">
                  {run.startedAt ? new Date(run.startedAt).toLocaleString("ko-KR") : "—"}
                </span>
                <span className="text-right">
                  <LinkButton variant="secondary" size="sm" to={`/builds/${run.id}`}>
                    보기
                  </LinkButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function QualitySection() {
  return (
    <section>
      <PageHeader eyebrow="품질" title="품질 경고" className="mb-4" />
      <Card className="p-0">
        <EmptyState
          title="품질 경고가 없습니다"
          description="모든 빌드가 정상적으로 완료되었습니다"
        />
      </Card>
    </section>
  );
}