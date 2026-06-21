import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewBuildPage } from "@/pages/NewBuildPage";
import { clearDraft } from "@/features/build-spec/draftStorage";

function renderWizard() {
  return render(
    <MemoryRouter>
      <NewBuildPage />
    </MemoryRouter>,
  );
}

describe("New Build draft persistence (#10)", () => {
  beforeEach(() => clearDraft());
  afterEach(() => clearDraft());

  it("saves the current input and restores it on a fresh mount", async () => {
    const first = renderWizard();
    // 템플릿 → 기본 정보
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(screen.getByLabelText(/데이터셋 ID/), { target: { value: "kma-daily" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    expect(screen.getByRole("button", { name: /저장됨/ })).toBeInTheDocument();

    // 새로 마운트하면 복원 배너가 보인다.
    first.unmount();
    renderWizard();
    expect(screen.getByText("저장된 초안이 있습니다. 이어서 편집할까요?")).toBeInTheDocument();

    // 불러오면 저장한 값으로 채워진 기본 정보 단계로 이동한다.
    fireEvent.click(screen.getByRole("button", { name: "불러오기" }));
    expect(screen.getByRole("heading", { name: "기본 정보" })).toBeInTheDocument();
    expect(screen.getByLabelText(/데이터셋 ID/)).toHaveValue("kma-daily");
  });

  it("discards the saved draft and hides the banner", () => {
    const first = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));
    first.unmount();

    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(
      screen.queryByText("저장된 초안이 있습니다. 이어서 편집할까요?"),
    ).not.toBeInTheDocument();
  });
});
