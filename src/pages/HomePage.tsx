/**
 * Studio 홈 대시보드 화면 - 신규 사용자/기존 사용자 상태 분기.
 *
 * Issue #248: Home을 신규 사용자·기존 사용자 상태로 구현한다.
 *
 * 신규 사용자 여부는 dataset/build 존재 여부로 판단한다.
 * - 신규 사용자: 환영 메시지, Kubi 자연어 hero(topbar KubiSearchInput과 동일한 seed 흐름 재사용),
 *   공공데이터 탐색, 데이터 바로 가져오기
 * - 기존 사용자: 실제 KPI (DATASETS, BUILD SUCCESS, VALIDATION WARN, RUNNING), 최근 데이터셋, 최근 Build stage 요약, 품질 경고/실패 Build
 *
 * Phase2 UI polish: "예시 데이터셋을 곧 만나보실 수 있습니다" placeholder 섹션은 제거했다 —
 * 실제 예시 데이터셋이 없는 상태에서 서비스가 미완성인 인상을 줬다. 같은 CTA는 이미
 * "공공데이터 탐색 → /discover" 카드가 담당한다.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useAssistConfig } from "@/features/assistant/config";
import { listBuilds } from "@/features/runs/api";
import { SUGGESTED_QUESTIONS } from "@/features/kubi/suggestedQuestions";
import { useKubiStore } from "@/features/kubi/useKubiSession";
import { useUIStore } from "@/shared/hooks/useUIStore";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildListItem } from "@/shared/lib/types";
import {
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Skeleton,
} from "@/shared/ui";

interface DashboardStats {
  datasetCount: number | null;
  buildSuccess: number | null;
  validationWarn: number | null;
  running: number | null;
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
export function HomePage() {
  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    datasetCount: 0,
    buildSuccess: 0,
    validationWarn: null,
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
        const realBuilder = isRealBuilderEnabled();
        const buildList = await listBuilds();
        // 비어 있는 목록은 신규 사용자 분기에 충분하며, 불필요한 monitoring 호출로 막지 않는다.
        const monitoring = realBuilder && buildList.length > 0
          ? await builderApi.getMonitoringBuilds().catch(() => null)
          : null;
        if (active) {
          setBuilds(buildList);
          setApiState((prev) => ({ ...prev, builds: "success" }));

          const succeeded = buildList.filter((b) => b.status === "succeeded").length;
          const running = buildList.filter((b) => b.status === "running" || b.status === "queued").length;

          const monitoredSuccess = monitoring?.availability === "available"
            ? monitoring.buckets.reduce((sum, bucket) => sum + bucket.success, 0)
            : null;
          setStats({
            datasetCount: realBuilder ? null : succeeded,
            buildSuccess: realBuilder ? monitoredSuccess : succeeded,
            validationWarn: null,
            // GET /builds의 real 계약은 terminal summary만 제공하므로 active 수로 해석하지 않는다.
            running: realBuilder ? null : running,
          });
          setApiState((prev) => ({ ...prev, stats: "success" }));
        }
      } catch {
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

  const isNew = apiState.builds === "success" && builds.length === 0;

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
        description="Kubi가 도와드립니다. 자연어로 물어보거나 원하는 방식으로 바로 시작하세요."
      />

      <KubiHero />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" className="flex flex-col items-center justify-center p-10 text-center">
          <h2 className="text-xl font-semibold tracking-tight">공공데이터 탐색</h2>
          <p className="mt-3 text-muted-foreground">
            어떤 공공데이터를 다룰 수 있는지 카탈로그에서 둘러보세요
          </p>
          <LinkButton className="mt-6" variant="secondary" to="/discover">
            탐색하기
          </LinkButton>
        </Card>

        <Card variant="elevated" className="flex flex-col items-center justify-center p-10 text-center">
          <h2 className="text-xl font-semibold tracking-tight">데이터 바로 가져오기</h2>
          <p className="mt-3 text-muted-foreground">
            Public API, 파일, URL에서 데이터를 직접 가져와 빌드하세요
          </p>
          <LinkButton className="mt-6" variant="secondary" to="/add">
            데이터 추가하기
          </LinkButton>
        </Card>
      </section>
    </>
  );
}

/**
 * Home의 Kubi 자연어 hero (#Phase2 UI polish).
 *
 * 새 assistant system이 아니라 topbar `KubiSearchInput`과 동일한 seed 흐름
 * (`useKubiStore().seedQuestion` + `useUIStore().openKubiDrawer`)을 재사용한다. 여기서
 * evidence 조회/LLM 호출을 직접 하지 않는다 — drawer가 열리면 `useKubiSession`이 이어받는다.
 *
 * `ask()`(useKubiSession.ts)는 seed를 받는 즉시 실행하고, API Key 미설정 시 `no_key` 에러
 * turn을 만든다. 여기서 원치 않는 에러 turn을 일부러 만들지 않기 위해, seed는
 * `isConfigured`일 때만 남기고 아니면 drawer만 열어 기존 API Key 설정 안내를 보여준다.
 */
function KubiHero() {
  const [query, setQuery] = useState("");
  const openKubiDrawer = useUIStore((state) => state.openKubiDrawer);
  const seedQuestion = useKubiStore((state) => state.seedQuestion);
  const { isConfigured } = useAssistConfig();

  function ask(question: string) {
    const trimmed = question.trim();
    if (trimmed && isConfigured) seedQuestion(trimmed);
    openKubiDrawer();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(query);
    setQuery("");
  }

  return (
    <Card variant="elevated" className="p-8">
      <h2 className="text-xl font-semibold tracking-tight">Kubi에게 필요한 데이터를 물어보세요</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        한국어로 질문하면 Kubi가 적합한 공공데이터를 찾고 BuildSpec까지 제안합니다.
      </p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="home-kubi-hero">
          Kubi에게 자연어로 데이터 물어보기
        </label>
        <input
          className="h-11 flex-1 rounded-lg border border-input bg-card px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="home-kubi-hero"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 서울 대기오염 데이터로 뭘 할 수 있어?"
          type="search"
          value={query}
        />
        <Button type="submit">Kubi에게 물어보기</Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent hover:text-foreground"
            onClick={() => ask(question)}
          >
            {question}
          </button>
        ))}
      </div>
      {!isConfigured ? (
        <p className="mt-3 text-xs text-muted-foreground">
          아직 API Key가 설정되지 않았습니다. Kubi를 열면 설정 방법을 안내합니다.
        </p>
      ) : null}
    </Card>
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
        {["DATASETS", "SUCCEEDED (24H)", "VALIDATION WARN", "RUNNING"].map((label) => (
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
      <KpiCard label="SUCCEEDED (24H)" value={stats.buildSuccess} loading={loading} variant="success" />
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
  value: number | null;
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
        {value === null ? "확인 불가" : value}
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
          title="품질 경고 집계 확인 불가"
          description="Builder monitoring API는 validation warning 집계를 제공하지 않습니다. 각 빌드의 품질 화면에서 확인하세요."
        />
      </Card>
    </section>
  );
}
