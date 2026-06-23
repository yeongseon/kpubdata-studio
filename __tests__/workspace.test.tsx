import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";
import { useWorkspaceStore } from "@/features/workspace/store";

beforeEach(() => {
  localStorage.clear();
  act(() => useWorkspaceStore.setState({ activeWorkspaceId: "personal" }));
});
afterEach(() => localStorage.clear());

describe("workspace store (#14)", () => {
  it("defaults to the first workspace", () => {
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("personal");
  });

  it("switches and persists the active workspace", () => {
    act(() => useWorkspaceStore.getState().setActiveWorkspace("team-data"));
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("team-data");
    expect(localStorage.getItem("kpubdata-studio:active-workspace")).toBe("team-data");
  });
});

describe("WorkspaceSwitcher (#14)", () => {
  it("renders the workspaces and switches on selection", () => {
    render(<WorkspaceSwitcher />);
    const select = screen.getByLabelText("활성 워크스페이스");
    expect(screen.getByRole("option", { name: "개인 워크스페이스" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "데이터팀" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "team-data" } });
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("team-data");
  });
});
