/**
 * Studio의 공통 앱 셸과 내비게이션 레이아웃을 정의하는 파일.
 *
 * 좌측 사이드바, 상단 헤더, 테마 전환, 모바일 오버레이를 한곳에서 관리하며
 * 실제 라우트 콘텐츠는 `Outlet`을 통해 주입한다.
 */
import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useUIStore } from "@/shared/hooks/useUIStore";

// 내비게이션은 Build 중심으로 단순화한다(제안 §6.3). Validate/Preview는 독립 메뉴에서
// 제거하고 New Build Wizard 내부 패널로 통합한다(§5.3/§5.4).
const primaryNavItems = [
  { to: "/", label: "대시보드", description: "최근 빌드와 빠른 시작", end: true },
  { to: "/builds", label: "빌드", description: "전체 빌드와 실행 이력", end: false },
  { to: "/builds/new", label: "새 빌드 (New Build)", description: "새 스펙 만들기", end: false },
  { to: "/artifacts", label: "결과물 (Artifacts)", description: "생성된 산출물", end: false },
  { to: "/settings", label: "설정 (Settings)", description: "Studio 환경설정", end: false },
] as const;

/**
 * 현재 테마 모드에 대응하는 DOM 테마 값.
 *
 * @param theme - UI 스토어에 저장된 현재 테마 모드.
 * @returns DOM `data-theme` 속성에 기록할 최종 테마 값.
 */
function getResolvedTheme(theme: ReturnType<typeof useUIStore.getState>["theme"]):
  | "light"
  | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
}

/**
 * 사이드바 링크의 활성/비활성 상태에 맞는 공통 Tailwind 클래스를 만든다.
 *
 * @param isActive - 현재 라우트와 링크가 일치하는지 여부.
 * @returns 시각 상태가 반영된 클래스 문자열.
 */
function navigationClassName({ isActive }: { isActive: boolean }) {
  return [
    "group flex items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition",
    isActive
      ? "border-zinc-900 bg-zinc-900 text-white shadow-lg shadow-zinc-950/10 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
      : "border-zinc-200/80 bg-white/70 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-950",
  ].join(" ");
}

/**
 * Studio 모든 페이지에 공통으로 적용되는 앱 셸 컴포넌트.
 *
 * @returns 사이드바, 헤더, 본문 슬롯을 포함한 전체 레이아웃.
 */
export function Layout() {
  const closeSidebar = useUIStore((state) => state.closeSidebar);
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const setTheme = useUIStore((state) => state.setTheme);
  const theme = useUIStore((state) => state.theme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  useEffect(() => {
    document.documentElement.dataset.theme = getResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {isSidebarOpen ? (
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-zinc-950/45 lg:hidden"
            onClick={closeSidebar}
            type="button"
          />
        ) : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-[18.5rem] flex-col border-r border-zinc-200/70 bg-white/90 px-5 py-5 backdrop-blur transition-transform dark:border-zinc-800 dark:bg-zinc-950/90 lg:static lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 pb-5 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
                KPubData Studio
              </p>
              <Link className="mt-2 block text-2xl font-semibold tracking-tight" to="/">
                공공데이터 빌드 스튜디오
              </Link>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                데이터 소스 선택부터 미리보기(Preview), 검증, 결과물까지 한 흐름으로 진행하세요.
              </p>
            </div>
            <button
              aria-label="Close sidebar"
              className="rounded-full border border-zinc-200 p-2 text-zinc-500 lg:hidden dark:border-zinc-800 dark:text-zinc-300"
              onClick={closeSidebar}
              type="button"
            >
              ✕
            </button>
          </div>

          <nav className="mt-6 flex flex-1 flex-col gap-6">
            <div className="space-y-3">
              {primaryNavItems.map((item) => (
                <NavLink
                  className={navigationClassName}
                  end={item.end}
                  key={item.to}
                  onClick={closeSidebar}
                  to={item.to}
                >
                  <div>
                    <p className="font-medium tracking-tight">{item.label}</p>
                    <p className="mt-1 text-sm opacity-80">{item.description}</p>
                  </div>
                  <span className="mt-1 text-xs uppercase tracking-[0.25em] opacity-60">
                    열기
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">테마</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  작업 중에도 화면이 잘 보이도록 테마를 선택하세요.
                </p>
              </div>
              <select
                aria-label="테마 선택"
                className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}
                value={theme}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
          <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Toggle sidebar"
                  className="inline-flex rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 shadow-sm lg:hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  onClick={toggleSidebar}
                  type="button"
                >
                  ☰
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                    Builder 제어 화면
                  </p>
                  <h1 className="text-lg font-semibold tracking-tight">
                    학생과 메인테이너를 위한 공공데이터 빌드 워크플로
                  </h1>
                </div>
              </div>

              <Link
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
                to="/builds/new"
              >
                새 빌드 만들기
              </Link>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
