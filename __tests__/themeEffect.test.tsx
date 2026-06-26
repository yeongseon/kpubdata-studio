/**
 * useThemeEffect 테스트 (#96).
 *
 * 저장된 테마 값이 실제로 `<html data-theme>`에 반영되는지(light/dark는 속성 설정, system은 제거)
 * 검증한다. 이전에는 테마를 저장만 하고 DOM에 적용하지 않아 다크 모드 전환이 동작하지 않았다.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeEffect } from "@/shared/hooks/useThemeEffect";
import { useUIStore } from "@/shared/hooks/useUIStore";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  useUIStore.setState({ theme: "system", isSidebarOpen: false });
  // jsdom에는 matchMedia가 없으므로 system 모드 구독용으로 스텁한다.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("useThemeEffect (#96)", () => {
  it("sets data-theme=dark on <html> when the theme is dark", () => {
    useUIStore.setState({ theme: "dark" });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets data-theme=light on <html> when the theme is light", () => {
    useUIStore.setState({ theme: "light" });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("removes data-theme on <html> for system mode (delegates to prefers-color-scheme)", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    useUIStore.setState({ theme: "system" });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("updates the attribute when the theme changes", () => {
    const { rerender } = renderHook(() => useThemeEffect());
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    useUIStore.getState().setTheme("dark");
    rerender();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
