/**
 * 검증 결과 페이지 (/validate, 레거시 딥링크).
 *
 * 검증은 New Build 마법사에 통합되어 있지만, 이 페이지에서 어시스턴트(ST-A5)를
 * 통해 검증 오류 설명과 수정 제안을 받을 수 있다.
 */
import { Card, EmptyState, PageHeader } from "@/shared/ui";
import { AssistantChat } from "@/features/assistant/AssistantChat";

export function ValidatePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="검증"
        title="검증 결과"
        description="필요한 항목을 확인하고 어시스턴트에게 수정 제안을 물어보세요."
      />

      <Card className="p-0">
        <EmptyState
          title="검증은 새 빌드 만들기 안에서 진행됩니다"
          description="필드별 오류와 수정 가이드는 New Build 마법사의 '검증·실행' 단계에서 바로 확인할 수 있습니다."
          actionLabel="새 빌드 만들기"
          actionHref="/builds/new"
        />
      </Card>

      <AssistantChat />
    </main>
  );
}
