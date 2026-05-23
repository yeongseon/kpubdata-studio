/**
 * 앱 셸 전반에서 재사용하는 UI 전역 상태 스토어.
 *
 * 사이드바 열림 여부와 테마 선택처럼 페이지를 넘나들며 유지해야 하는 시각 상태를 관리한다.
 */
import { create } from "zustand";

/** 현재 Studio 셸이 지원하는 테마 모드 집합 */
export type ThemeMode = "system" | "light" | "dark";

interface UIState {
  /** 모바일/태블릿 레이아웃에서 사이드바가 열려 있는지 여부 */
  isSidebarOpen: boolean;
  /** 사용자가 선택한 테마 모드 */
  theme: ThemeMode;
  /** 사이드바 열림/닫힘 상태를 뒤집는 액션 */
  toggleSidebar: () => void;
  /** 사이드바를 강제로 여는 액션 */
  openSidebar: () => void;
  /** 사이드바를 강제로 닫는 액션 */
  closeSidebar: () => void;
  /** 테마 모드를 새 값으로 갱신하는 액션 */
  setTheme: (theme: ThemeMode) => void;
}

/**
 * 레이아웃 공통 UI 상태를 읽고 갱신하는 Zustand 훅.
 *
 * @returns 현재 UI 상태와 상태 변경 액션 집합.
 */
export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  theme: "system",
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  setTheme: (theme) => set({ theme }),
}));
