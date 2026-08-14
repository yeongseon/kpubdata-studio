import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("global Kubi drawer (#247)", () => {
  beforeEach(() => {
    // jsdom에는 matchMedia가 없으므로 system 테마 분기를 피하도록 light로 고정한다.
    act(() =>
      useUIStore.setState({ theme: "light", isMobileSidebarOpen: false, isKubiDrawerOpen: false }),
    );
  });

  it("is closed by default and opens from the topbar Kubi button", () => {
    renderLayoutAt("/");
    expect(screen.queryByRole("dialog", { name: "Kubi AI Assistant" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kubi 열기" }));

    expect(screen.getByRole("dialog", { name: "Kubi AI Assistant" })).toBeInTheDocument();
  });

  it("shows the current screen's context label", () => {
    renderLayoutAt("/quality");
    fireEvent.click(screen.getByRole("button", { name: "Kubi 열기" }));

    expect(screen.getByText("Quality 화면 문맥")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderLayoutAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Kubi 열기" }));
    expect(screen.getByRole("dialog", { name: "Kubi AI Assistant" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Kubi AI Assistant" })).not.toBeInTheDocument();
  });

  it("traps keyboard focus and restores it to the opener when closed", () => {
    renderLayoutAt("/");
    const openButton = screen.getByRole("button", { name: "Kubi 열기" });
    openButton.focus();
    fireEvent.click(openButton);

    const closeButtons = screen.getAllByRole("button", { name: "Kubi 닫기" });
    const drawerCloseButton = closeButtons[1];
    expect(drawerCloseButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(drawerCloseButton).toHaveFocus();

    fireEvent.click(drawerCloseButton);
    expect(openButton).toHaveFocus();
  });

  it("closes via the close button (overlay + header X share the same label)", () => {
    renderLayoutAt("/");

    fireEvent.click(screen.getByRole("button", { name: "Kubi 열기" }));
    const closeButtons = screen.getAllByRole("button", { name: "Kubi 닫기" });
    expect(closeButtons).toHaveLength(2); // overlay button + header X 버튼

    fireEvent.click(closeButtons[0]);
    expect(screen.queryByRole("dialog", { name: "Kubi AI Assistant" })).not.toBeInTheDocument();
  });

  it("opens the drawer when the topbar search is submitted", () => {
    renderLayoutAt("/");
    const searchInput = screen.getByLabelText("Kubi에게 자연어로 데이터 물어보기");
    fireEvent.change(searchInput, { target: { value: "서울 대기오염 데이터셋 찾아줘" } });
    fireEvent.submit(searchInput.closest("form")!);

    expect(screen.getByRole("dialog", { name: "Kubi AI Assistant" })).toBeInTheDocument();
  });
});
