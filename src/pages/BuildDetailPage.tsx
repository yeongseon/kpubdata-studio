/**
 * 빌드 상세 요약 페이지 (/builds/:buildId).
 *
 * 빌드의 현재 상태와 편집/실행/결과물/게시로 이어지는 하위 흐름 진입점을 보여준다.
 * 실제 데이터는 #29 Builder API 연동 시 useBuild(buildId)로 채운다.
 */
import { Link, useParams } from "react-router-dom";
import { Card, LinkButton, PageHeader, Skeleton } from "@/shared/ui";

const SUBPAGES = [
  { segment: "edit", label: "편집", description: "스펙 수정" },
  { segment: "run", label: "실행", description: "빌드 실행 및 추적" },
  { segment: "artifacts", label: "결과물", description: "파일과 manifest 확인" },
  { segment: "publish", label: "게시", description: "배포 전 검토 및 publish" },
] as const;

/**
 * 빌드 상세 요약과 하위 흐름 진입 카드를 보여주는 페이지.
 *
 * @returns 빌드 상세 화면.
 */
export function BuildDetailPage() {
  const { buildId = "" } = useParams();

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="빌드 상세"
        title={buildId || "빌드"}
        description="이 빌드의 상태를 확인하고 편집·실행·결과물·게시 단계로 이동하세요."
        actions={<LinkButton to={`/builds/${buildId}/run`}>실행하기</LinkButton>}
      />

      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">현재 상태</span>
        <Skeleton className="h-5 w-16 rounded-full" />
        <span className="text-sm text-muted-foreground">
          Builder API 연동(#29) 후 실제 상태가 표시됩니다.
        </span>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        {SUBPAGES.map((sub) => (
          <Link
            key={sub.segment}
            to={`/builds/${buildId}/${sub.segment}`}
            className="rounded-xl border border-border bg-card p-5 transition hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-base font-semibold tracking-tight">{sub.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sub.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
