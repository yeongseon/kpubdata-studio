import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as runsApi from "@/features/runs/api";
import { BuildsPage } from "@/pages/BuildsPage";

function renderBuilds() {
  return render(
    <MemoryRouter>
      <BuildsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("shows an error state with retry when listing fails (#71)", async () => {
    const realBuilds = await runsApi.listBuilds();
    const spy = vi
      .spyOn(runsApi, "listBuilds")
      .mockRejectedValueOnce(new Error("네트워크 오류"));
    renderBuilds();

    expect(await screen.findByText("빌드 목록을 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 오류");

    // 재시도하면 실제 목록을 다시 불러온다.
    spy.mockResolvedValueOnce(realBuilds);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
  });
});
