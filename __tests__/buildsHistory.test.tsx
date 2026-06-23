import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BuildsPage } from "@/pages/BuildsPage";

function renderBuilds() {
  return render(
    <MemoryRouter>
      <BuildsPage />
    </MemoryRouter>,
  );
}

describe("Builds run history (#12)", () => {
  it("renders rows with status badges and a view link", async () => {
    renderBuilds();
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument(); // succeeded badge
    expect(screen.getByText("실패")).toBeInTheDocument(); // failed badge
    expect(screen.getAllByRole("link", { name: "보기" }).length).toBe(3);
  });

  it("filters the history by title search", async () => {
    renderBuilds();
    await screen.findByText("대기오염 정보");

    fireEvent.change(screen.getByLabelText("빌드 제목 검색"), { target: { value: "인구" } });

    await waitFor(() => {
      expect(screen.queryByText("대기오염 정보")).not.toBeInTheDocument();
    });
    expect(screen.getByText("인구 통계")).toBeInTheDocument();
  });
});
