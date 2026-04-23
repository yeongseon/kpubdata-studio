import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "@/shared/hooks/useUIStore";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({ isSidebarOpen: false, theme: "system" });
  });

  it("toggles the sidebar state", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });
});
