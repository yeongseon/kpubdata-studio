/**
 * 앱 셸 전반에서 재사용하는 UI 전역 상태 스토어.
 *
 * 모바일 사이드바 오버레이 열림 여부, 데스크톱 사이드바 접힘 여부, 전역 Kubi drawer 열림 여부,
 * 테마 선택처럼 페이지를 넘나들며 유지해야 하는 시각 상태를 관리한다. 모바일 오버레이와 데스크톱
 * collapse는 서로 다른 레이아웃 개념이라 상태를 분리한다 — 모바일에서 열어둔 오버레이가 데스크톱
 * collapse에 영향을 주거나, 그 반대가 되어서는 안 된다(#247).
 *
 * `persist` 미들웨어로 localStorage에 저장하는 값은 테마(#83)와 데스크톱 collapse 선호(#247)뿐이다.
 * 모바일 오버레이 열림 상태는 의도적으로 저장하지 않아, 새로고침 후 모바일 메뉴가 열린 채로
 * 되살아나지 않는다(항상 닫힌 상태로 시작).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 현재 Studio 셸이 지원하는 테마 모드 집합 */
export type ThemeMode = "system" | "light" | "dark";

interface UIState {
  /** 모바일/태블릿 레이아웃에서 사이드바 오버레이가 열려 있는지 여부 (persist 안 함) */
  isMobileSidebarOpen: boolean;
  /** 데스크톱 레이아웃에서 사이드바가 접혀 있는지 여부 (persist 가능, #247) */
  isDesktopSidebarCollapsed: boolean;
  /** 전역 Kubi drawer가 열려 있는지 여부 (#247) */
  isKubiDrawerOpen: boolean;
  /** 사용자가 선택한 테마 모드 */
  theme: ThemeMode;
  /** 모바일 사이드바 오버레이 열림/닫힘 상태를 뒤집는 액션 */
  toggleMobileSidebar: () => void;
  /** 모바일 사이드바 오버레이를 강제로 여는 액션 */
  openMobileSidebar: () => void;
  /** 모바일 사이드바 오버레이를 강제로 닫는 액션 */
  closeMobileSidebar: () => void;
  /** 데스크톱 사이드바 접힘/펼침 상태를 뒤집는 액션 */
  toggleDesktopSidebarCollapsed: () => void;
  /** Kubi drawer를 여는 액션 */
  openKubiDrawer: () => void;
  /** Kubi drawer를 닫는 액션 */
  closeKubiDrawer: () => void;
  /** Kubi drawer 열림/닫힘 상태를 뒤집는 액션 */
  toggleKubiDrawer: () => void;
  /** 테마 모드를 새 값으로 갱신하는 액션 */
  setTheme: (theme: ThemeMode) => void;
}

/**
 * 레이아웃 공통 UI 상태를 읽고 갱신하는 Zustand 훅.
 *
 * @returns 현재 UI 상태와 상태 변경 액션 집합.
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isMobileSidebarOpen: false,
      isDesktopSidebarCollapsed: false,
      isKubiDrawerOpen: false,
      theme: "system",
      toggleMobileSidebar: () =>
        set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
      openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
      closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
      toggleDesktopSidebarCollapsed: () =>
        set((state) => ({ isDesktopSidebarCollapsed: !state.isDesktopSidebarCollapsed })),
      openKubiDrawer: () => set({ isKubiDrawerOpen: true }),
      closeKubiDrawer: () => set({ isKubiDrawerOpen: false }),
      toggleKubiDrawer: () => set((state) => ({ isKubiDrawerOpen: !state.isKubiDrawerOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "kpubdata-studio:ui",
      // 테마와 데스크톱 collapse 선호만 저장한다. 모바일 오버레이 열림 상태는 저장하지 않아
      // 새로고침 시 항상 닫힌 채 시작한다(데스크톱 collapse 복원과는 독립적으로 동작해야 함).
      partialize: (state) => ({
        theme: state.theme,
        isDesktopSidebarCollapsed: state.isDesktopSidebarCollapsed,
      }),
    },
  ),
);
