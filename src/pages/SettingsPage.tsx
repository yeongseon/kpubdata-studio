/**
 * Studio 환경 설정 확인 화면.
 *
 * 현재는 환경 변수로 주입된 Builder API 엔드포인트를 노출해 연결 상태를 점검할 수 있게 한다.
 */
import { API_BASE } from "@/shared/config/env";

/**
 * 환경 기반 설정 값을 읽어 사용자에게 보여주는 페이지 컴포넌트.
 *
 * @returns 설정 스캐폴드 화면.
 */
export function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Settings
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Studio configuration scaffold</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
          Keep environment-driven API endpoint settings visible while students wire actual persistence later.
        </p>
      </div>

      <section className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Builder API endpoint
        </p>
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="text-sm font-medium">Current base URL</p>
          <code className="mt-3 block break-all text-sm text-emerald-700 dark:text-emerald-400">
            {API_BASE}
          </code>
        </div>
      </section>
    </main>
  );
}
