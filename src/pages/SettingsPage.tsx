/**
 * Studio 환경 설정 페이지 (/settings).
 *
 * 환경 변수로 주입된 Builder API 엔드포인트를 노출해 연결 상태를 점검할 수 있게 한다.
 */
import { API_BASE } from "@/shared/config/env";
import { Card, PageHeader } from "@/shared/ui";

/**
 * 환경 기반 설정 값을 보여주는 페이지 컴포넌트.
 *
 * @returns 설정 화면.
 */
export function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="설정"
        title="환경 설정"
        description="Builder API 엔드포인트 등 환경값을 확인합니다. 실제 저장 기능은 이후 연동됩니다."
      />

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Builder API 엔드포인트
        </p>
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="text-sm font-medium">현재 base URL</p>
          <code className="mt-3 block break-all text-sm text-emerald-700 dark:text-emerald-400">
            {API_BASE}
          </code>
        </div>
      </Card>
    </main>
  );
}
