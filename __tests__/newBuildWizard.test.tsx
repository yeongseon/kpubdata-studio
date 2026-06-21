import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NewBuildPage } from "@/pages/NewBuildPage";

function renderWizard() {
  return render(
    <MemoryRouter>
      <NewBuildPage />
    </MemoryRouter>,
  );
}

describe("New Build Wizard", () => {
  it("starts on the first step", () => {
    renderWizard();
    expect(screen.getByRole("heading", { name: "기본 정보" })).toBeInTheDocument();
    // 스텝퍼 + 헤딩 모두에 "기본 정보"가 나타난다(최소 2곳).
    expect(screen.getAllByText("기본 정보").length).toBeGreaterThanOrEqual(2);
  });

  it("blocks advancing while required fields are empty", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText(/데이터셋 ID를 입력해주세요/)).toBeInTheDocument();
    // 검증 실패로 1단계 헤딩에 머문다.
    expect(screen.getByRole("heading", { name: "기본 정보" })).toBeInTheDocument();
  });

  it("advances to the source step once identity fields are filled", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "kma-daily" } });
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "기상청 일별" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "일별 관측 데이터" } });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(await screen.findByRole("heading", { name: "데이터 소스" })).toBeInTheDocument();
    expect(screen.getByLabelText(/제공자/)).toBeInTheDocument();
  });
});
