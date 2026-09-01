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
import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
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
  qualityWarn: number | null;
  running: number | null;
}

/**
 * 각 KPI aggregate는 독립적인 API 경계다 — 하나가 실패해도 나머지 KPI 값과
 * Recent Builds는 영향받지 않는다. "loading"은 skeleton, "unavailable"은
 * "확인 불가"(임의 숫자 합성 없음)로 렌더된다.
 */
type KpiPhase = "loading" | "ready" | "unavailable";

interface KpiPhases {
  /** DATASETS — GET /datasets의 authoritative `total` (Builder 1.22.0). */
  datasets: KpiPhase;
  /** SUCCEEDED (24H) + RUNNING — GET /monitoring/* 공유 경계. */
  monitoring: KpiPhase;
  /** QUALITY WARN (24H) — GET /quality/summary (Builder 1.22.0). */
  quality: KpiPhase;
}

/**
 * DATASETS KPI + 신규 사용자 판정을 위한 authoritative dataset total만 독립적으로
 * 조회한다 — monitoring/quality 경계는 건드리지 않는다.
 *
 * 1.21.0 이하 Builder는 `total`을 보내지 않으므로 그때는 items.length/limit로
 * 대체하지 않고 "확인 불가"(kpi.datasets="unavailable", datasetCount=null)로 둔다.
 * 호출부는 이 상태를 "dataset 없음"으로 오해하지 않는다.
 */
function loadDatasetTotal(
  isActive: () => boolean,
  setStats: Dispatch<SetStateAction<DashboardStats>>,
  setKpi: Dispatch<SetStateAction<KpiPhases>>,
): void {
  builderApi
    .listDatasets(1)
    .then((res) => {
      if (!isActive()) return;
      setStats((prev) => ({ ...prev, datasetCount: res.total ?? null }));
      setKpi((prev) => ({ ...prev, datasets: res.total === undefined ? "unavailable" : "ready" }));
    })
    .catch(() => {
      if (!isActive()) return;
      setStats((prev) => ({ ...prev, datasetCount: null }));
      setKpi((prev) => ({ ...prev, datasets: "unavailable" }));
    });
}

/**
 * 실연동 모드에서 Home KPI 3개 경계를 각각 독립적으로 로드한다.
 *
 * 세 요청은 서로를, 그리고 이미 커밋된 Recent Builds를 절대 block하지 않는다.
 * 한 aggregate가 실패/미지원이면 해당 KPI만 "확인 불가"가 되고 값을 지어내지 않는다.
 */
function loadRealKpis(
  isActive: () => boolean,
  setStats: Dispatch<SetStateAction<DashboardStats>>,
  setKpi: Dispatch<SetStateAction<KpiPhases>>,
): void {
  // (1) DATASETS — dataset total.
  loadDatasetTotal(isActive, setStats, setKpi);

  // (2) SUCCEEDED (24H) + RUNNING — monitoring. 각 endpoint 실패는 그 값만 null로.
  void Promise.all([
    builderApi.getMonitoringBuilds().catch(() => null),
    builderApi.getMonitoringSummary().catch(() => null),
  ]).then(([monitoring, summary]) => {
    if (!isActive()) return;
    const monitoredSuccess =
      monitoring?.availability === "available"
        ? monitoring.buckets.reduce((sum, bucket) => sum + bucket.success, 0)
        : null;
    setStats((prev) => ({
      ...prev,
      buildSuccess: monitoredSuccess,
      // GET /builds의 real 계약은 terminal summary만 제공하므로 active 수로 해석하지 않는다.
      running: summary?.queue.running ?? null,
    }));
    setKpi((prev) => ({ ...prev, monitoring: "ready" }));
  });

  // (3) QUALITY WARN (24H) — quality summary. 미지원(1.21.0 이하 → 404)/실패면 "확인 불가".
  builderApi
    .getQualitySummary()
    .then((res) => {
      if (!isActive()) return;
      setStats((prev) => ({
        ...prev,
        qualityWarn: res.availability === "available" ? res.warn_runs : null,
      }));
      setKpi((prev) => ({ ...prev, quality: "ready" }));
    })
    .catch(() => {
      if (!isActive()) return;
      setStats((prev) => ({ ...prev, qualityWarn: null }));
      setKpi((prev) => ({ ...prev, quality: "unavailable" }));
    });
}

/**
 * 신규 사용자 여부를 판단한다.
 *
 * 신규 사용자는 "빌드도 dataset도 없음"이 실제로 확인됐을 때만 확정한다. 빈 build
 * 목록만으로는 부족하다 — dataset은 있는데 아직 build를 돌리지 않은 사용자를 신규로
 * 오판할 수 있기 때문이다. real 모드에서는 Builder GET /datasets의 authoritative
 * `total`(1.22.0)을 함께 확인하고, total이 unavailable(구버전 Builder / 404·5xx)이면
 * 신규로 추측하지 않고 기존 대시보드를 보여준다(DATASETS만 "확인 불가").
 */
export function HomePage() {
  const realBuilder = isRealBuilderEnabled();
  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [buildsState, setBuildsState] = useState<"loading" | "error" | "success">("loading");
  const [stats, setStats] = useState<DashboardStats>({
    datasetCount: null,
    buildSuccess: null,
    qualityWarn: null,
    running: null,
  });
  const [kpi, setKpi] = useState<KpiPhases>({
    datasets: "loading",
    monitoring: "loading",
    quality: "loading",
  });

  useEffect(() => {
    let active = true;

    // real Builder의 aggregate는 Recent Builds와 독립적인 API 경계다. /builds의
    // 성공 여부나 빈 목록 여부와 무관하게 즉시 시작한다.
    if (realBuilder) {
      loadRealKpis(() => active, setStats, setKpi);
    }

    // Recent Builds는 KPI 요청과 완전히 독립이다 — 받는 즉시 커밋하고, 실패하면
    // KPI와 무관하게 그 섹션만 에러 상태로 둔다.
    listBuilds()
      .then((list) => {
        if (!active) return;
        setBuilds(list);
        setBuildsState("success");

        // real 모드 aggregate는 effect 시작 시 이미 독립적으로 요청했다. 빈 build는
        // 신규 사용자 판정의 한 근거일 뿐, monitoring/quality를 unavailable로 만들지 않는다.
        if (list.length === 0) {
          if (!realBuilder) {
            setKpi({ datasets: "unavailable", monitoring: "unavailable", quality: "unavailable" });
          }
          return;
        }

        if (realBuilder) {
          return;
        }

        // mock/demo: 기존 demo 의미 유지 — mock 목록에서 직접 계산한다. 여기는
        // 애초에 mock 모드이므로 real 실패를 mock 숫자로 대체하는 경로가 아니다.
        const succeeded = list.filter((b) => b.status === "succeeded").length;
        const running = list.filter(
          (b) => b.status === "running" || b.status === "queued",
        ).length;
        setStats({ datasetCount: null, buildSuccess: succeeded, qualityWarn: null, running });
        setKpi({ datasets: "unavailable", monitoring: "ready", quality: "unavailable" });
      })
      .catch(() => {
        if (!active) return;
        setBuildsState("error");
        // real aggregate는 /builds 오류와 독립적으로 계속 진행한다. mock/demo의
        // 기존 동작만 유지해, 근거 없는 KPI를 표시하지 않는다.
        if (!realBuilder) {
          setKpi({ datasets: "unavailable", monitoring: "unavailable", quality: "unavailable" });
        }
      });

    return () => {
      active = false;
    };
  }, [realBuilder]);

  const recentBuilds = [...builds]
    .sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  // real 모드: 빌드 0개 + dataset total 조회 성공(kpi.datasets="ready") + total===0
  // 이 모두 충족될 때만 신규 사용자로 확정한다. total이 unavailable이면 빈 build만으로
  // 추측하지 않는다. mock/demo 모드에는 dataset aggregate 권위가 없으므로 기존
  // build 기반 판정을 그대로 유지한다.
  const datasetsConfirmedEmpty = kpi.datasets === "ready" && stats.datasetCount === 0;
  const isNew =
    buildsState === "success" &&
    builds.length === 0 &&
    (realBuilder ? datasetsConfirmedEmpty : true);

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      {isNew ? (
        <NewUserHome />
      ) : (
        <ExistingUserHome
          stats={stats}
          recentBuilds={recentBuilds}
          buildsState={buildsState}
          kpi={kpi}
        />
      )}
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
  buildsState,
  kpi,
}: {
  stats: DashboardStats;
  recentBuilds: BuildListItem[];
  buildsState: "loading" | "error" | "success";
  kpi: KpiPhases;
}) {
  return (
    <>
      <PageHeader
        eyebrow="대시보드"
        title="작업 현황을 한눈에 확인하세요"
        description="최근 데이터셋, 빌드 상태, 품질 경고를 모니터링합니다"
      />

      <KpiCards stats={stats} kpi={kpi} />

      <section className="grid gap-6 xl:grid-cols-2">
        <RecentBuildsSection
          recentBuilds={recentBuilds}
          loading={buildsState === "loading"}
          apiState={buildsState}
        />
        <QualitySection />
      </section>
    </>
  );
}

/**
 * KPI 4칸. 각 칸은 자기 aggregate 경계의 phase만 본다 — 한 aggregate가 실패해도
 * 다른 칸은 정상 값을 유지하고, 전체를 한꺼번에 에러로 덮지 않는다. null 값은
 * KpiCard가 "확인 불가"로 렌더한다(임의 숫자 합성 없음).
 */
function KpiCards({ stats, kpi }: { stats: DashboardStats; kpi: KpiPhases }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="DATASETS" value={stats.datasetCount} loading={kpi.datasets === "loading"} />
      <KpiCard
        label="SUCCEEDED (24H)"
        value={stats.buildSuccess}
        loading={kpi.monitoring === "loading"}
        variant="success"
      />
      <KpiCard
        label="QUALITY WARN (24H)"
        value={stats.qualityWarn}
        loading={kpi.quality === "loading"}
        variant="error"
      />
      <KpiCard label="RUNNING" value={stats.running} loading={kpi.monitoring === "loading"} />
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

function RecentBuildsSection({
  recentBuilds,
  loading,
  apiState,
}: {
  recentBuilds: BuildListItem[];
  loading: boolean;
  apiState: "loading" | "error" | "success";
}) {
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
          title="개별 품질 경고 목록은 아직 제공되지 않습니다"
          description="최근 24시간 WARN run 수는 위의 QUALITY WARN (24H) KPI에서 확인할 수 있습니다. 어떤 run이 경고인지는 각 빌드의 품질 화면에서 확인하세요."
        />
      </Card>
    </section>
  );
}
