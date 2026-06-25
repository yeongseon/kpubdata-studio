import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "@/shared/hooks/useUIStore";

describe("useUIStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ isSidebarOpen: false, theme: "system" });
  });

  it("toggles the sidebar state", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });

  it("persists only the theme to localStorage (#83)", () => {
    useUIStore.getState().setTheme("dark");
    useUIStore.getState().openSidebar();

    const persisted = JSON.parse(localStorage.getItem("kpubdata-studio:ui") ?? "{}");
    expect(persisted.state.theme).toBe("dark");
    // 사이드바 상태는 저장하지 않는다(데스크톱에서 모바일 드로어 부활 방지).
    expect(persisted.state.isSidebarOpen).toBeUndefined();
  });
});
