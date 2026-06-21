/**
 * 빌드 결과물 페이지 (/builds/:buildId/artifacts).
 *
 * manifest 요약, 생성 파일 목록, 다운로드/게시 액션을 보여준다(제안 §5.7).
 * 실제 manifest/파일은 #30 manifest viewer + #29 API 연동 시 채운다.
 */
import { useParams } from "react-router-dom";
import { Card, EmptyState, LinkButton, PageHeader } from "@/shared/ui";

/**
 * 빌드가 생성한 결과물과 manifest 요약을 보여주는 페이지.
 *
 * @returns 결과물 화면.
 */
export function BuildArtifactsPage() {
  const { buildId = "" } = useParams();

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="결과물"
        title={`${buildId || "빌드"} 결과물`}
        description="빌드가 생성한 파일, manifest, 다운로드 링크를 확인하세요."
        actions={<LinkButton to={`/builds/${buildId}/publish`}>게시하기</LinkButton>}
      />

      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Manifest 요약
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          datasetId · 레코드 수 · 출력 형식 등 manifest 메타데이터가 여기에 표시됩니다 (#30).
        </p>
      </Card>

      <Card className="p-0">
        <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.8fr] gap-4 border-b border-zinc-200/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>파일</span>
          <span>형식</span>
          <span>크기</span>
          <span>액션</span>
        </div>
        <EmptyState
          title="생성된 파일이 없습니다"
          description="빌드가 성공하면 생성된 파일과 다운로드/미리보기 액션이 여기에 표시됩니다."
        />
      </Card>
    </main>
  );
}
