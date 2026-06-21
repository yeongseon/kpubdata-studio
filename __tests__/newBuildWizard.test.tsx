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

// 마법사는 템플릿 단계에서 시작한다(#11). 식별 단계로 넘어가는 헬퍼.
function skipTemplateStep() {
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
}

describe("New Build Wizard", () => {
  it("starts on the template step", () => {
    renderWizard();
    expect(screen.getByRole("heading", { name: "템플릿 선택" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /대기오염 정보/ })).toBeInTheDocument();
  });

  it("selecting a template prefills the form and advances to identity", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /대기오염 정보/ }));

    expect(screen.getByRole("heading", { name: "기본 정보" })).toBeInTheDocument();
    expect(screen.getByLabelText(/데이터셋 ID/)).toHaveValue("datago-air-quality");
  });

  it("blocks advancing while required fields are empty", async () => {
    renderWizard();
    skipTemplateStep(); // 템플릿 → 기본 정보
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText(/데이터셋 ID를 입력해주세요/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "기본 정보" })).toBeInTheDocument();
  });

  it("advances to the source step once identity fields are filled", async () => {
    renderWizard();
    skipTemplateStep();
    fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "kma-daily" } });
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "기상청 일별" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "일별 관측 데이터" } });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(await screen.findByRole("heading", { name: "데이터 소스" })).toBeInTheDocument();
    expect(screen.getByLabelText(/제공자/)).toBeInTheDocument();
  });

  it("blocks the params step when the JSON is invalid", async () => {
    renderWizard();
    skipTemplateStep();
    fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "kma-daily" } });
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "기상청 일별" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "일별 관측" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await screen.findByRole("heading", { name: "데이터 소스" });
    fireEvent.change(screen.getByLabelText(/제공자/), { target: { value: "datago" } });
    fireEvent.change(screen.getByLabelText(/데이터셋/), { target: { value: "air-quality" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await screen.findByRole("heading", { name: "파라미터" });
    fireEvent.change(screen.getByLabelText(/요청 파라미터/), { target: { value: "{not json" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(await screen.findByText(/올바른 JSON이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "파라미터" })).toBeInTheDocument();
  });
});
