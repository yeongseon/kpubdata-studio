/**
 * Studio 홈 대시보드 화면.
 *
 * 사용자가 가장 먼저 보는 화면으로, 빌드 상태 요약, 최근 빌드, 빠른 시작 진입점을
 * 보여준다(제안 §5.1). 실제 수치/목록은 #29 Builder API 연동 시 채운다.
 */
import { Link } from "react-router-dom";
import type { BuildRun } from "@/shared/lib/types";
import { Card, EmptyState, LinkButton, PageHeader, type StatusValue } from "@/shared/ui";

// 상태 요약 카드. 수치는 Builder API 연동 전까지 0으로 둔다.
const STATUS_SUMMARY: { status: StatusValue; label: string; count: number }[] = [
  { status: "draft", label: "초안", count: 0 },
  { status: "running", label: "실행 중", count: 0 },
  { status: "failed", label: "실패", count: 0 },
  { status: "succeeded", label: "성공", count: 0 },
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

/**
 * 상태 요약·최근 빌드·빠른 시작을 보여주는 대시보드 페이지.
 *
 * @returns Studio 대시보드 메인 화면.
 */
export function HomePage() {
  const recentBuilds: BuildRun[] = [];

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
        {STATUS_SUMMARY.map((item) => (
          <Card key={item.status} className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">{item.label}</span>
            <span className="text-2xl font-semibold tracking-tight">{item.count}</span>
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
              description="공공데이터 템플릿으로 첫 빌드를 만들어보세요. 실행 이력은 Builder API 연동(#29) 후 여기에 표시됩니다."
              actionLabel="새 빌드 만들기"
              actionHref="/builds/new"
            />
          ) : null}
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
              className="rounded-[1.75rem] border border-zinc-200/80 bg-white/80 p-5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-zinc-700"
            >
              <p className="text-lg font-medium tracking-tight">{action.label}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
