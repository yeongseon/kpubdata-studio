/**
 * 미리보기 페이지 (/preview, 레거시 딥링크).
 *
 * 미리보기는 이제 New Build 마법사의 ‘미리보기’ 단계에 통합되어 있다(제안 §5.3).
 * 이 화면은 딥링크 호환을 위해 유지하며, 마법사로 안내한다.
 */
import { Card, EmptyState, PageHeader } from "@/shared/ui";

/**
 * 미리보기 흐름을 마법사로 안내하는 레거시 페이지.
 *
 * @returns 미리보기 안내 화면.
 */
export function PreviewPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="미리보기"
        title="데이터 미리보기"
        description="현재 설정으로 가져올 수 있는 샘플 데이터를 확인하는 단계입니다."
      />

      <Card className="p-0">
        <EmptyState
          title="미리보기는 새 빌드 만들기 안에서 진행됩니다"
          description="샘플 행과 컬럼 스키마는 New Build 마법사의 ‘미리보기’ 단계에서 바로 확인할 수 있습니다."
          actionLabel="새 빌드 만들기"
          actionHref="/builds/new"
        />
      </Card>
    </main>
  );
}
