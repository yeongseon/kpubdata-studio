/**
 * 결과물 랜딩 페이지 (/artifacts).
 *
 * 결과물은 빌드 단위로 관리되므로(제안 §5.7), 이 전역 화면은 빌드 선택으로 안내한다.
 * 빌드별 상세 결과물은 /builds/:buildId/artifacts 에서 확인한다.
 */
import { Card, EmptyState, PageHeader } from "@/shared/ui";

/**
 * 빌드별 결과물 화면으로 안내하는 전역 결과물 랜딩 페이지.
 *
 * @returns 결과물 랜딩 화면.
 */
export function ArtifactsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="결과물"
        title="생성된 결과물"
        description="결과물은 빌드 단위로 관리됩니다. 빌드를 선택하면 파일·manifest·다운로드를 볼 수 있습니다."
      />

      <Card className="p-0">
        <EmptyState
          title="빌드를 선택하세요"
          description="빌드 목록에서 빌드를 연 뒤 ‘결과물’ 탭에서 파일과 manifest를 확인할 수 있습니다."
          actionLabel="빌드 목록으로"
          actionHref="/builds"
        />
      </Card>
    </main>
  );
}
