import { act, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Layout } from "@/app/Layout";
import { useUIStore } from "@/shared/hooks/useUIStore";

describe("Layout sidebar accessibility", () => {
  beforeEach(() => {
    // jsdom에는 matchMedia가 없으므로 system 테마 분기를 피하도록 light로 고정한다.
    act(() => useUIStore.setState({ theme: "light", isSidebarOpen: false }));
  });

  it("closes the open sidebar when Escape is pressed", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    // 마운트 시 closeSidebar가 호출되므로, ESC 동작을 검증하기 위해 다시 연다.
    act(() => useUIStore.setState({ isSidebarOpen: true }));
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });
});
