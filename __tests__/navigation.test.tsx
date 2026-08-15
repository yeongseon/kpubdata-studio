import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Layout } from "@/app/Layout";
import { useUIStore } from "@/shared/hooks/useUIStore";

function renderLayoutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
}

describe("grouped sidebar navigation (#247)", () => {
  beforeEach(() => {
    // jsdom에는 matchMedia가 없으므로 system 테마 분기를 피하도록 light로 고정한다.
    act(() =>
      useUIStore.setState({
        theme: "light",
        isMobileSidebarOpen: false,
        isDesktopSidebarCollapsed: false,
        isKubiDrawerOpen: false,
      }),
    );
  });

  it("renders the WORKSPACE/DATA/AI/SYSTEM groups from the HTML prototype IA", () => {
    renderLayoutAt("/");

    for (const group of ["WORKSPACE", "DATA", "AI", "SYSTEM"]) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }
  });

  it("exposes every IA route as a sidebar link", () => {
    renderLayoutAt("/");
    const nav = screen.getByRole("navigation");

    const expectedLinks: Record<string, string> = {
      "Home (홈)": "/",
      "Discover (탐색)": "/discover",
      "Workspace (작업대)": "/workspace",
      "Add Data (데이터 추가)": "/add",
      "Dataset Catalog (데이터셋)": "/datasets",
      "Builds / Runs (빌드)": "/builds",
      "Quality (품질)": "/quality",
      Kubi: "/kubi",
      "Reports (리포트)": "/reports",
      "Provider (제공기관)": "/provider",
      "Monitoring (모니터링)": "/monitoring",
      "Settings (설정)": "/settings",
    };

    for (const [label, href] of Object.entries(expectedLinks)) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("marks the current route as active via aria-current", () => {
    renderLayoutAt("/quality");
    const nav = screen.getByRole("navigation");

    expect(within(nav).getByRole("link", { name: "Quality (품질)" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home (홈)" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks only Home active at the root path (end match)", () => {
    renderLayoutAt("/");
    const nav = screen.getByRole("navigation");

    expect(within(nav).getByRole("link", { name: "Home (홈)" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes the mobile sidebar when a nav link is clicked", () => {
    renderLayoutAt("/");
    act(() => useUIStore.setState({ isMobileSidebarOpen: true }));
    expect(useUIStore.getState().isMobileSidebarOpen).toBe(true);

    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("link", { name: "Discover (탐색)" }));

    expect(useUIStore.getState().isMobileSidebarOpen).toBe(false);
  });

  it("opens and closes the mobile sidebar overlay", () => {
    renderLayoutAt("/");
    expect(screen.queryByRole("button", { name: "내비게이션 닫기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "사이드바 열기/닫기" }));
    expect(useUIStore.getState().isMobileSidebarOpen).toBe(true);
    expect(screen.getByRole("button", { name: "내비게이션 닫기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "내비게이션 닫기" }));
    expect(useUIStore.getState().isMobileSidebarOpen).toBe(false);
  });

  it("keeps every IA route link accessible while the desktop sidebar is collapsed (#247)", () => {
    act(() => useUIStore.setState({ isDesktopSidebarCollapsed: true }));
    renderLayoutAt("/");
    const nav = screen.getByRole("navigation");

    expect(within(nav).getByRole("link", { name: "Home (홈)" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Quality (품질)" })).toHaveAttribute(
      "href",
      "/quality",
    );
  });
});
