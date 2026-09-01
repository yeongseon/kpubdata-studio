import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FirstRunTour, ONBOARDING_STORAGE_KEY, resetFirstRunTour } from "./FirstRunTour";

describe("FirstRunTour", () => {
  beforeEach(() => localStorage.clear());

  it("미완료 상태에서 표시하고 Skip을 저장해 reload 자동 표시를 막는다", () => {
    const first = render(<FirstRunTour />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("complete");
    first.unmount();
    render(<FirstRunTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Finish 저장 후 다시 보기 action으로 재실행한다", () => {
    render(<FirstRunTour />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => resetFirstRunTour());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
