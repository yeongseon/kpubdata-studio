/**
 * Studio의 공통 앱 셸과 내비게이션 레이아웃을 정의하는 파일.
 *
 * 좌측 사이드바, 상단 헤더, 테마 전환, 모바일 오버레이를 한곳에서 관리하며
 * 실제 라우트 콘텐츠는 `Outlet`을 통해 주입한다.
 */
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useUIStore } from "@/shared/hooks/useUIStore";

/**
 * 현재 라우트에 맞는 헤더 CTA(라벨/이동 경로)를 고른다(제안 §6.4).
 *
 * 새 빌드 작성 화면에서는 중복되는 '새 빌드 만들기' 대신 '빌드 목록'으로 안내하고,
 * 그 외 화면에서는 새 빌드 작성으로 유도한다.
 *
 * @param pathname - 현재 경로.
 * @returns 헤더 CTA의 라벨과 이동 경로.
 */
function headerCtaFor(pathname: string): { to: string; label: string } {
  if (pathname === "/builds/new") return { to: "/builds", label: "빌드 목록" };
  if (pathname.startsWith("/builds/") && pathname.endsWith("/run"))
    return { to: pathname.replace(/\/run$/, "/artifacts"), label: "결과물 보기" };
  return { to: "/builds/new", label: "새 빌드 만들기" };
}

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
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    isActive
      ? "bg-accent-subtle text-accent-subtle-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
  const { pathname } = useLocation();
  const headerCta = headerCtaFor(pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = getResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar]);

  // 모바일 사이드바가 열려 있을 때 ESC로 닫을 수 있게 한다(접근성, 제안 §12.2).
  useEffect(() => {
    if (!isSidebarOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {isSidebarOpen ? (
          <button
            aria-label="내비게이션 닫기"
            className="fixed inset-0 z-30 bg-zinc-950/45 lg:hidden"
            onClick={closeSidebar}
            type="button"
          />
        ) : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card px-4 py-5 transition-transform lg:static lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                  K
                </span>
                <Link className="text-base font-semibold tracking-tight" to="/">
                  KPubData Studio
                </Link>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                데이터 소스 선택부터 미리보기, 검증, 결과물까지 한 흐름으로 진행하세요.
              </p>
            </div>
            <button
              aria-label="사이드바 닫기"
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
              onClick={closeSidebar}
              type="button"
            >
              ✕
            </button>
          </div>

          <nav className="mt-2 flex flex-1 flex-col">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              메뉴
            </p>
            <div className="space-y-1">
              {primaryNavItems.map((item) => (
                <NavLink
                  className={navigationClassName}
                  end={item.end}
                  key={item.to}
                  onClick={closeSidebar}
                  to={item.to}
                  title={item.description}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="mt-4 rounded-lg border border-border bg-muted p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">테마</p>
              <select
                aria-label="테마 선택"
                className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm"
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
          <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
              <div className="flex items-center gap-3">
                <button
                  aria-label="사이드바 열기/닫기"
                  className="inline-flex rounded-lg border border-border bg-card p-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
                  onClick={toggleSidebar}
                  type="button"
                >
                  ☰
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Builder 제어 화면
                  </p>
                  <h1 className="text-base font-semibold tracking-tight">
                    학생과 메인테이너를 위한 공공데이터 빌드 워크플로
                  </h1>
                </div>
              </div>

              <Link
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                to={headerCta.to}
              >
                {headerCta.label}
              </Link>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
