import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NewBuildPage } from "@/pages/NewBuildPage";

function next() {
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
}

async function goToReviewAndValidate() {
  render(
    <MemoryRouter>
      <NewBuildPage />
    </MemoryRouter>,
  );
  next(); // 템플릿 → 기본 정보
  fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "air-quality" } });
  fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "대기오염" } });
  fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "설명" } });
  next(); // → 데이터 소스
  await screen.findByRole("heading", { name: "데이터 소스" });
  fireEvent.change(screen.getByLabelText(/제공자/), { target: { value: "datago" } });
  fireEvent.change(screen.getByLabelText(/데이터셋/), { target: { value: "air" } });
  next(); // → 파라미터 (기본 "{}" 유효)
  await screen.findByRole("heading", { name: "파라미터" });
  next(); // → 미리보기
  await screen.findByRole("heading", { name: "미리보기" });
  next(); // → 출력 형식 (기본 jsonl + outputPath)
  await screen.findByRole("heading", { name: "출력 형식" });
  next(); // → 검증·실행
  await screen.findByRole("heading", { name: "검증·실행" });
  fireEvent.click(screen.getByRole("button", { name: "다시 검증" }));
  // mock validateSpec → valid → 빌드 실행 활성화
  await screen.findByText("검증을 통과했습니다. 빌드를 실행할 수 있습니다.");
}

describe("New Build wizard — run build (#39 wiring)", () => {
  it("runs the build (mock) and shows success after validation", async () => {
    await goToReviewAndValidate();

    const runButton = screen.getByRole("button", { name: "빌드 실행" });
    expect(runButton).toBeEnabled();
    fireEvent.click(runButton);

    expect(await screen.findByText(/빌드 성공/)).toBeInTheDocument();
  });
});
