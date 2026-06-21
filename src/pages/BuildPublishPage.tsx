/**
 * 빌드 게시 페이지 (/builds/:buildId/publish).
 *
 * 데이터셋 카드 검토, 배포 대상 선택, 게시 전 검증, 게시 실행을 보여준다(제안 §5.8).
 * 실제 게시는 #9 Publish flow + Builder publish API 연동 시 채운다.
 */
import { useParams } from "react-router-dom";
import { Button, Card, PageHeader } from "@/shared/ui";

const DESTINATIONS = [
  { id: "local", label: "로컬 다운로드 (Local only)" },
  { id: "huggingface", label: "HuggingFace Dataset" },
  { id: "github", label: "GitHub Release" },
] as const;

/**
 * 배포 전 검토와 게시 대상 선택을 보여주는 페이지.
 *
 * @returns 게시 검토 화면.
 */
export function BuildPublishPage() {
  const { buildId = "" } = useParams();

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="게시"
        title={`${buildId || "빌드"} 게시`}
        description="배포 전에 데이터셋 메타데이터와 라이선스를 확인하고 게시 대상을 선택하세요."
      />

      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          검토 (Review)
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">제목</dt>
            <dd className="text-zinc-800 dark:text-zinc-100">—</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">라이선스</dt>
            <dd className="text-zinc-800 dark:text-zinc-100">—</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          데이터셋 카드 정보는 #9 Publish flow 연동 시 manifest에서 채워집니다.
        </p>
      </Card>

      <Card>
        <fieldset>
          <legend className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            배포 대상 (Destination)
          </legend>
          <div className="mt-4 flex flex-col gap-3">
            {DESTINATIONS.map((dest, index) => (
              <label key={dest.id} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="publish-destination"
                  value={dest.id}
                  defaultChecked={index === 0}
                  className="h-4 w-4 accent-zinc-900 dark:accent-white"
                />
                {dest.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <div>
        <Button disabled>게시 (연동 예정)</Button>
      </div>
    </main>
  );
}
