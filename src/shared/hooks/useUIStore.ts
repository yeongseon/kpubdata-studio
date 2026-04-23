import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

interface UIState {
  isSidebarOpen: boolean;
  theme: ThemeMode;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  theme: "system",
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  setTheme: (theme) => set({ theme }),
}));
