/**
 * PreviewValidationStep — stale 결과 경고 (감사 후속 1-2).
 *
 * Dataset/params가 직전 Preview 이후 바뀌면(AddDataPage의 isStale) Step 자체에서
 * "남아 있는 결과가 현재 설정과 다르다"는 사실을 보여줘야 한다. Build 차단은
 * ReviewBuildStep의 기존 stale guard가 담당하므로 여기서는 표시만 검증한다.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PreviewValidationStep, type PreviewState } from "./PreviewValidationStep";

const LOADED: PreviewState = {
  status: "loaded",
  response: { dataset_id: "dataset-1", previews: [] },
};

function renderStep(overrides: Partial<React.ComponentProps<typeof PreviewValidationStep>>) {
  return render(
    <MemoryRouter>
      <PreviewValidationStep
        preview={LOADED}
        limit={5}
        sampleMode="first"
        columns="key"
        onChangeLimit={vi.fn()}
        onChangeSampleMode={vi.fn()}
        onChangeColumns={vi.fn()}
        onRefresh={vi.fn()}
        view="sample"
        onChangeView={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe("PreviewValidationStep — stale 결과 경고", () => {
  it("isStale이면 남아 있는 Preview 결과가 현재 설정과 다르다고 알린다", () => {
    renderStep({ isStale: true });
    expect(screen.getByText(/설정이 변경되었습니다.*Preview를 다시 실행/)).toBeInTheDocument();
  });

  it("isStale이 아니면 경고를 표시하지 않는다", () => {
    renderStep({ isStale: false });
    expect(screen.queryByText(/설정이 변경되었습니다/)).not.toBeInTheDocument();
  });

  it("Preview를 아직 실행하지 않았으면(idle) stale이어도 경고하지 않는다", () => {
    renderStep({ isStale: true, preview: { status: "idle" } });
    expect(screen.queryByText(/설정이 변경되었습니다/)).not.toBeInTheDocument();
  });
});
