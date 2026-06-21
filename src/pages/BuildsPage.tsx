/**
 * 빌드 목록 페이지 (/builds).
 *
 * 전체 빌드와 실행 이력을 표로 보여준다(제안 §5.6). 실제 목록/상태는 #29 Builder API
 * 연동 시 useBuilds()로 채운다.
 */
import type { BuildRun } from "@/shared/lib/types";
import { Card, EmptyState, LinkButton, PageHeader } from "@/shared/ui";

const COLUMNS = ["빌드", "상태", "마지막 실행", "액션"] as const;

/**
 * 빌드 실행 목록 표와 새 빌드 진입점을 보여주는 페이지.
 *
 * @returns 빌드 목록 화면.
 */
export function BuildsPage() {
  const runs: BuildRun[] = [];

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="빌드"
        title="빌드 목록"
        description="전체 빌드와 대기·실행·완료 상태의 실행 이력을 확인하세요."
        actions={<LinkButton to="/builds/new">새 빌드 만들기</LinkButton>}
      />

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr] gap-4 border-b border-zinc-200/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {COLUMNS.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>

        {runs.length === 0 ? (
          <EmptyState
            title="아직 생성된 빌드가 없습니다"
            description="첫 빌드를 만들면 여기에 상태와 실행 이력이 표시됩니다. (목록 API는 #29 연동 시 연결됩니다.)"
            actionLabel="새 빌드 만들기"
            actionHref="/builds/new"
          />
        ) : null}
      </Card>
    </main>
  );
}
