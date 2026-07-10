/**
 * Studio 홈 대시보드 화면.
 *
 * 사용자가 가장 먼저 보는 화면으로, 빌드 상태 요약, 최근 빌드, 빠른 시작 진입점을
 * 보여준다(제안 §5.1). 상태 요약 수치와 최근 빌드 목록은 `listBuilds()`(mock 모드에서는
 * 실제 builder 스펙 기반 데모 데이터, 실연동 모드에서는 Builder API) 결과로 채운다.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBuilds } from "@/features/runs/api";
import type { BuildRun, BuildRunStatus } from "@/shared/lib/types";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
  type StatusValue,
} from "@/shared/ui";

/** 대시보드 상태 요약 카드에 표시할 실행 상태와 라벨. */
const SUMMARY_CARDS: { status: Extract<StatusValue, BuildRunStatus>; label: string }[] = [
  { status: "queued", label: "대기 중" },
  { status: "running", label: "실행 중" },
  { status: "succeeded", label: "성공" },
  { status: "failed", label: "실패" },
];

const QUICK_ACTIONS = [
  {
    href: "/builds/new",
    label: "새 빌드 만들기",
    description: "데이터 소스·파라미터·출력 형식을 단계별로 설정합니다.",
  },
  {
    href: "/builds",
    label: "빌드 목록 보기",
    description: "전체 빌드와 실행 이력을 확인합니다.",
  },
  {
    href: "/artifacts",
    label: "결과물 확인",
    description: "생성된 파일과 manifest, 다운로드 링크를 봅니다.",
  },
];

/** ISO 시작 시각을 timestamp로 안전하게 변환한다(파싱 실패 시 0). */
function startedAtMillis(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** ISO 시각을 한국어 로케일 문자열로 표시한다. */
function formatTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("ko-KR");
}

/**
 * 상태 요약·최근 빌드·빠른 시작을 보여주는 대시보드 페이지.
 *
 * @returns Studio 대시보드 메인 화면.
 */
export function HomePage() {
  const [builds, setBuilds] = useState<BuildRun[]>([]);

  useEffect(() => {
    let active = true;
    listBuilds()
      .then((result) => {
        if (active) setBuilds(result);
      })
      .catch(() => {
        if (active) setBuilds([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = builds.reduce<Record<string, number>>((acc, run) => {
    acc[run.status] = (acc[run.status] ?? 0) + 1;
    return acc;
  }, {});

  const recentBuilds = [...builds]
    .sort((a, b) => startedAtMillis(b.startedAt) - startedAtMillis(a.startedAt))
    .slice(0, 5);

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="대시보드"
        title="공공데이터 수집부터 결과물 생성까지 한 번에 관리하세요"
        description="템플릿을 선택하고, 미리보기와 검증을 거쳐 안전하게 빌드를 실행할 수 있습니다."
        actions={<LinkButton to="/builds/new">새 빌드 만들기</LinkButton>}
      />

      {/* 상태 요약 카드 (§5.1) */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((item) => (
          <Card key={item.status} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-2xl font-semibold tracking-tight">
              {counts[item.status] ?? 0}
            </span>
          </Card>
        ))}
      </section>

      {/* 최근 빌드 (§5.1) */}
      <section>
        <PageHeader eyebrow="최근 빌드" title="최근 실행" className="mb-4" />
        <Card className="p-0">
          {recentBuilds.length === 0 ? (
            <EmptyState
              title="아직 생성된 빌드가 없습니다"
              description="공공데이터 템플릿으로 첫 빌드를 만들어보세요. 실행 이력은 여기에 표시됩니다."
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
                  <span className="font-medium">{run.spec.title}</span>
                  <span>
                    <StatusBadge status={run.status} />
                  </span>
                  <span className="text-muted-foreground">{formatTime(run.startedAt)}</span>
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

      {/* 빠른 시작 */}
      <section>
        <PageHeader eyebrow="빠른 시작" title="필요한 단계에서 바로 시작하세요" className="mb-4" />
        <div className="grid gap-4 xl:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-zinc-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="text-lg font-medium tracking-tight">{action.label}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
