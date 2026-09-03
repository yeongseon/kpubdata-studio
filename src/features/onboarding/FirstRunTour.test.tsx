import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FirstRunTour, onboardingStorageKey, resetFirstRunTour } from "./FirstRunTour";

const USER_ID = "keycloak-subject-1";

describe("FirstRunTour", () => {
  beforeEach(() => localStorage.clear());

  it("미완료 상태에서 표시하고 Skip을 저장해 reload 자동 표시를 막는다", () => {
    const first = render(<FirstRunTour userId={USER_ID} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(localStorage.getItem(onboardingStorageKey(USER_ID))).toBe("complete");
    first.unmount();
    render(<FirstRunTour userId={USER_ID} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Finish 저장 후 다시 보기 action으로 재실행한다", () => {
    render(<FirstRunTour userId={USER_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => resetFirstRunTour(USER_ID));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
