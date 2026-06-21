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

  it("blocks the params step when the JSON is invalid", async () => {
    renderWizard();
    // 1단계: 기본 정보
    fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "kma-daily" } });
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "기상청 일별" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "일별 관측" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // 2단계: 데이터 소스
    await screen.findByRole("heading", { name: "데이터 소스" });
    fireEvent.change(screen.getByLabelText(/제공자/), { target: { value: "datago" } });
    fireEvent.change(screen.getByLabelText(/데이터셋/), { target: { value: "air-quality" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // 3단계: 파라미터 — 잘못된 JSON 입력 후 다음 시도
    await screen.findByRole("heading", { name: "파라미터" });
    fireEvent.change(screen.getByLabelText(/요청 파라미터/), { target: { value: "{not json" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // JSON 오류가 필드에 표시되고 단계 이동이 막힌다.
    expect(await screen.findByText(/올바른 JSON이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "파라미터" })).toBeInTheDocument();
  });
});
