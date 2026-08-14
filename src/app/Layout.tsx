/**
 * Studio의 공통 앱 셸과 내비게이션 레이아웃을 정의하는 파일.
 *
 * 좌측 grouped 사이드바, 상단 헤더(Kubi 검색·Kubi 버튼·avatar), 테마 전환, 모바일 오버레이,
 * 전역 Kubi drawer mount를 한곳에서 관리하며 실제 라우트 콘텐츠는 `Outlet`을 통해 주입한다.
 * 메뉴 구성은 `kpubdata_ui_prototype_v1.html` IA(WORKSPACE/DATA/AI/SYSTEM)를 따른다(#247).
 */
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { KubiDrawer } from "@/features/kubi/KubiDrawer";
import { KubiSearchInput } from "@/features/kubi/KubiSearchInput";
import { useUIStore } from "@/shared/hooks/useUIStore";

/**
 * 현재 라우트에 맞는 헤더 CTA(라벨/이동 경로)를 고른다(제안 §6.4).
 *
 * 새 빌드 작성 화면에서는 중복되는 '새 빌드 만들기' 대신 '빌드 목록'으로 안내하고,
 * 그 외 화면에서는 새 빌드 작성으로 유도한다. 새 IA의 Discover/Add Data/Quality 등 신규
 * placeholder 화면은 이 조건들과 겹치지 않으므로 그대로 기본값(새 빌드 만들기)을 받는다(#247).
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

interface NavItem {
  /** 이동 경로 */
  to: string;
  /** 사이드바에 표시할 라벨 */
  label: string;
  /** 링크 title(hover 설명) */
  description: string;
  /** index 라우트처럼 정확히 일치할 때만 active로 표시할지 여부 */
  end?: boolean;
}

interface NavGroup {
  /** 그룹 헤더 라벨(대문자 표기, 프로토타입 IA와 동일) */
  label: string;
  items: NavItem[];
}

// 최종 IA(WORKSPACE/DATA/AI/SYSTEM)를 그대로 반영한 grouped nav model이다(#247).
// New Build Wizard(`/builds/new`)는 메뉴에서 제거됐지만 route와 헤더 CTA에서는 계속 쓰인다 —
// Add Data Workbench(#250)가 이를 흡수하기 전까지는 유일한 실제 빌드 생성 흐름이기 때문이다.
const navGroups: NavGroup[] = [
  {
    label: "WORKSPACE",
    items: [
      { to: "/", label: "Home (홈)", description: "최근 작업 요약과 빠른 시작", end: true },
      { to: "/discover", label: "Discover (탐색)", description: "Provider·데이터셋 탐색" },
      { to: "/workspace", label: "Workspace (작업대)", description: "최근 작업과 저장한 BuildSpec" },
    ],
  },
  {
    label: "DATA",
    items: [
      { to: "/add", label: "Add Data (데이터 추가)", description: "Public API·File·URL로 데이터 추가" },
      { to: "/datasets", label: "Dataset Catalog (데이터셋)", description: "발행된 데이터셋 검색" },
      { to: "/builds", label: "Builds / Runs (빌드)", description: "빌드와 실행 이력" },
      { to: "/quality", label: "Quality (품질)", description: "빌드·데이터셋 품질 결과" },
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/kubi", label: "Kubi", description: "Context-aware AI 어시스턴트" },
      { to: "/reports", label: "Reports (리포트)", description: "분석 리포트 생성·열람" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/provider", label: "Provider (제공기관)", description: "Provider 연결·자격 증명" },
      { to: "/monitoring", label: "Monitoring (모니터링)", description: "실행·시스템 모니터링" },
    ],
  },
];

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
 * 로그인된 이메일에서 avatar에 표시할 이니셜 한 글자를 뽑는다.
 *
 * 로그인 전이거나 이메일이 없으면 물음표를 보여줘 "아직 로그인하지 않음"을 드러낸다.
 * 실제 avatar 메뉴/프로필 화면은 #263(Email/Password Auth)에서 이 상태를 이어받는다.
 *
 * @param email - 로그인된 사용자 이메일(없으면 `null`).
 * @returns avatar에 표시할 한 글자.
 */
function avatarInitial(email: string | null): string {
  return email ? email.charAt(0).toUpperCase() : "?";
}

/**
 * Studio 모든 페이지에 공통으로 적용되는 앱 셸 컴포넌트.
 *
 * @returns 사이드바, 헤더, 본문 슬롯, 전역 Kubi drawer를 포함한 전체 레이아웃.
 */
export function Layout() {
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar);
  const isMobileSidebarOpen = useUIStore((state) => state.isMobileSidebarOpen);
  const isDesktopSidebarCollapsed = useUIStore((state) => state.isDesktopSidebarCollapsed);
  const openKubiDrawer = useUIStore((state) => state.openKubiDrawer);
  const setTheme = useUIStore((state) => state.setTheme);
  const theme = useUIStore((state) => state.theme);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const toggleDesktopSidebarCollapsed = useUIStore(
    (state) => state.toggleDesktopSidebarCollapsed,
  );
  const email = useAuthStore((state) => state.email);
  const { pathname } = useLocation();
  const headerCta = headerCtaFor(pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = getResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    closeMobileSidebar();
  }, [closeMobileSidebar]);

  // 모바일 사이드바가 열려 있을 때 ESC로 닫을 수 있게 한다(접근성, 제안 §12.2).
  // 데스크톱 collapse는 오버레이가 아니므로 ESC 대상이 아니다 — 이 핸들러는 모바일 상태만 본다.
  // Kubi drawer의 ESC 처리는 drawer 자신이 열려 있을 때만 담당한다(KubiDrawer 참고).
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobileSidebar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileSidebarOpen, closeMobileSidebar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {isMobileSidebarOpen ? (
          <button
            aria-label="내비게이션 닫기"
            className="fixed inset-0 z-30 bg-zinc-950/45 lg:hidden"
            onClick={closeMobileSidebar}
            type="button"
          />
        ) : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto border-r border-border bg-card px-4 py-5 transition-all lg:static lg:translate-x-0",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
            isDesktopSidebarCollapsed ? "lg:w-20 lg:px-2" : "lg:w-72",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                  K
                </span>
                <Link
                  className={[
                    "text-base font-semibold tracking-tight",
                    isDesktopSidebarCollapsed ? "lg:sr-only" : "",
                  ].join(" ")}
                  to="/"
                >
                  KPubData Studio
                </Link>
              </div>
              <p
                className={[
                  "mt-3 text-sm leading-relaxed text-muted-foreground",
                  isDesktopSidebarCollapsed ? "lg:sr-only" : "",
                ].join(" ")}
              >
                데이터 탐색부터 빌드, 품질, Kubi 분석까지 한 흐름으로 진행하세요.
              </p>
            </div>
            <button
              aria-label="사이드바 닫기"
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
              onClick={closeMobileSidebar}
              type="button"
            >
              ✕
            </button>
            {/* 데스크톱 전용 접기/펼치기 토글 — 모바일 닫기 버튼과 반대로 lg 이상에서만 노출되어
                항상 접근 가능하다(#247). collapsed 상태에서도 이 버튼 자체는 숨지 않는다. */}
            <button
              aria-label={isDesktopSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="hidden shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:inline-flex"
              onClick={toggleDesktopSidebarCollapsed}
              type="button"
            >
              {isDesktopSidebarCollapsed ? "»" : "«"}
            </button>
          </div>

          <nav className="mt-2 flex flex-1 flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p
                  className={[
                    "px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    isDesktopSidebarCollapsed ? "lg:sr-only" : "",
                  ].join(" ")}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      className={navigationClassName}
                      end={item.end}
                      key={item.to}
                      onClick={closeMobileSidebar}
                      title={item.description}
                      to={item.to}
                    >
                      <span className={isDesktopSidebarCollapsed ? "lg:sr-only" : undefined}>
                        {item.label}
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-auto space-y-1 border-t border-border pt-3">
              <NavLink
                className={navigationClassName}
                onClick={closeMobileSidebar}
                title="Studio 환경설정"
                to="/settings"
              >
                <span className={isDesktopSidebarCollapsed ? "lg:sr-only" : undefined}>
                  Settings (설정)
                </span>
              </NavLink>
            </div>
          </nav>

          <div
            className={[
              "mt-4 rounded-lg border border-border bg-muted p-3",
              isDesktopSidebarCollapsed ? "lg:sr-only" : "",
            ].join(" ")}
          >
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
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="사이드바 열기/닫기"
                  className="inline-flex rounded-lg border border-border bg-card p-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
                  onClick={toggleMobileSidebar}
                  type="button"
                >
                  ☰
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    KPubData Studio
                  </p>
                  <h1 className="truncate text-base font-semibold tracking-tight">
                    공공데이터 탐색·빌드·품질·Kubi 워크플로
                  </h1>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
                <KubiSearchInput />

                <button
                  aria-haspopup="dialog"
                  aria-label="Kubi 열기"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={openKubiDrawer}
                  type="button"
                >
                  <span aria-hidden="true">✨</span>
                  <span className="hidden sm:inline">Kubi</span>
                </button>

                <Link
                  className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex"
                  to={headerCta.to}
                >
                  {headerCta.label}
                </Link>

                {/* avatar 진입점 — #263에서 실제 프로필/로그아웃 메뉴로 확장될 구조(#247). */}
                <Link
                  aria-label={email ? `${email} 계정 메뉴로 이동` : "로그인이 필요합니다 — 설정으로 이동"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  title={email ?? "로그인이 필요합니다"}
                  to="/settings"
                >
                  {avatarInitial(email)}
                </Link>
              </div>
            </div>
          </header>

          <Outlet />
        </div>
      </div>

      <KubiDrawer />
    </div>
  );
}
