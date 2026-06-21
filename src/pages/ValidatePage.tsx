/**
 * 검증 결과 페이지 (/validate, 레거시 딥링크).
 *
 * 검증은 이제 New Build 마법사의 ‘검증·실행’ 단계에 통합되어 있다(제안 §5.4).
 * 이 화면은 딥링크 호환을 위해 유지하며, 마법사로 안내한다.
 */
import { Card, EmptyState, PageHeader } from "@/shared/ui";

/**
 * 검증 흐름을 마법사로 안내하는 레거시 페이지.
 *
 * @returns 검증 안내 화면.
 */
export function ValidatePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="검증"
        title="검증 결과"
        description="입력값과 빌드 설정에서 수정이 필요한 항목을 확인하는 단계입니다."
      />

      <Card className="p-0">
        <EmptyState
          title="검증은 새 빌드 만들기 안에서 진행됩니다"
          description="필드별 오류와 수정 가이드는 New Build 마법사의 ‘검증·실행’ 단계에서 바로 확인할 수 있습니다."
          actionLabel="새 빌드 만들기"
          actionHref="/builds/new"
        />
      </Card>
    </main>
  );
}
