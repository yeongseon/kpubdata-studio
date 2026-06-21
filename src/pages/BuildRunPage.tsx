/**
 * 빌드 실행 추적 페이지 (/builds/:buildId/run).
 *
 * 실행 상태 헤더, 단계별 진행률(Stepper), 로그 영역, 다음 행동을 보여준다(제안 §5.5).
 * 실제 진행 상태/로그는 #39 비동기 job 연동과 #29 API 연동 시 채운다.
 */
import { Link, useParams } from "react-router-dom";
import { Button, Card, EmptyState, PageHeader, StatusBadge, Stepper } from "@/shared/ui";

const RUN_STEPS = [
  { id: "queued", label: "대기" },
  { id: "fetching", label: "수집" },
  { id: "normalizing", label: "정규화" },
  { id: "exporting", label: "내보내기" },
  { id: "uploading", label: "업로드" },
  { id: "completed", label: "완료" },
];

/**
 * 빌드 실행 진행 상태와 로그를 추적하는 페이지.
 *
 * @returns 실행 추적 화면.
 */
export function BuildRunPage() {
  const { buildId = "" } = useParams();

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="실행"
        title={`${buildId || "빌드"} 실행`}
        description="빌드 실행 단계와 진행 상태를 실시간으로 추적합니다."
        actions={
          <Button variant="secondary" disabled>
            취소
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">상태</span>
        <StatusBadge status="queued" />
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          진행 단계
        </p>
        <Stepper steps={RUN_STEPS} current={0} />
      </Card>

      <Card variant="dashed" className="p-0">
        <EmptyState
          title="실행 로그가 아직 없습니다"
          description="실행을 시작하면 수집·정규화·내보내기 로그가 여기에 표시됩니다. 비동기 실행 연동은 #39에서 진행됩니다."
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary">
          <Link to={`/builds/${buildId}/artifacts`}>결과물 보기</Link>
        </Button>
        <Button variant="ghost">
          <Link to={`/builds/${buildId}/edit`}>스펙 수정</Link>
        </Button>
      </div>
    </main>
  );
}
