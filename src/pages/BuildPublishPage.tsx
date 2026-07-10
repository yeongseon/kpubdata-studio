/**
 * 빌드 게시 페이지 (/builds/:buildId/publish).
 *
 * 데이터셋 검토, 배포 대상 선택, 게시 실행/상태를 보여준다(제안 §5.8, #9). 실제 게시는
 * Builder publish 엔드포인트가 생기기 전까지 mock으로 동작한다.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { type PublishDestination } from "@/features/publish/api";
import { usePublishJob } from "@/features/publish/usePublishJob";
import { Button, Card, PageHeader, StatusBadge } from "@/shared/ui";

const DESTINATIONS: { id: PublishDestination; label: string }[] = [
  { id: "local", label: "로컬 다운로드 (Local only)" },
  { id: "huggingface", label: "HuggingFace Dataset" },
  { id: "github", label: "GitHub Release" },
];

/**
 * 배포 전 검토와 게시 실행을 보여주는 페이지.
 *
 * @returns 게시 화면.
 */
export function BuildPublishPage() {
  const { buildId = "" } = useParams();
  const [destination, setDestination] = useState<PublishDestination>("local");
  const publish = usePublishJob();
  const isPublishing = publish.status === "publishing";

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="게시"
        title={`${buildId || "빌드"} 게시`}
        description="배포 전에 데이터셋 메타데이터와 라이선스를 확인하고 게시 대상을 선택하세요."
      />

      <Card>
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          검토 (Review)
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">빌드 ID</dt>
            <dd className="break-all text-foreground">{buildId || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">대상</dt>
            <dd className="text-foreground">
              {DESTINATIONS.find((d) => d.id === destination)?.label}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          제목·라이선스 등 데이터셋 카드 정보는 Builder publish 엔드포인트 연동 시 manifest에서
          채워집니다.
        </p>
      </Card>

      <Card>
        <fieldset disabled={isPublishing}>
          <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            배포 대상 (Destination)
          </legend>
          <div className="mt-4 flex flex-col gap-3">
            {DESTINATIONS.map((dest) => (
              <label key={dest.id} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="publish-destination"
                  value={dest.id}
                  checked={destination === dest.id}
                  onChange={() => setDestination(dest.id)}
                  className="h-4 w-4 accent-emerald-600"
                />
                {dest.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          loading={isPublishing}
          disabled={isPublishing || !buildId}
          onClick={() => void publish.start(buildId, destination)}
        >
          게시
        </Button>
        {isPublishing ? (
          <Button variant="secondary" onClick={publish.cancel}>
            취소
          </Button>
        ) : null}
        {publish.status === "published" ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status="published" />
            {publish.result?.url ? (
              <a
                href={publish.result.url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline dark:text-emerald-300"
              >
                결과 보기
              </a>
            ) : (
              <span className="text-muted-foreground">
                게시가 완료되었습니다. 실제 결과 링크는 Builder 연동 후 표시됩니다.
              </span>
            )}
          </span>
        ) : null}
        {publish.status === "failed" ? (
          <span role="alert" className="text-sm text-red-700 dark:text-red-300">
            {publish.error}
          </span>
        ) : null}
        {publish.status === "cancelled" ? (
          <span className="text-sm text-muted-foreground">게시가 취소되었습니다.</span>
        ) : null}
      </div>
    </main>
  );
}
