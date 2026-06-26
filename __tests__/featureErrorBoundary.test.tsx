/**
 * FeatureErrorBoundary 테스트 (#97).
 *
 * 단일 feature의 렌더 오류가 전역 폴백까지 버블업해 셸 전체가 사라지는 것을 막고, 해당 영역만
 * 폴백으로 대체하는지, 주변 셸(사이드바 등)은 정상 유지되는지, ‘다시 시도’로 복구되는지 검증한다.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureErrorBoundary } from "@/app/ErrorBoundary";

function Boom(): never {
  throw new Error("feature boom");
}

describe("FeatureErrorBoundary (#97)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates a feature error to its own area while the shell stays mounted", () => {
    render(
      <div>
        <nav>사이드바</nav>
        <FeatureErrorBoundary feature="미리보기">
          <Boom />
        </FeatureErrorBoundary>
      </div>,
    );

    // feature 영역은 영역 한정 폴백을 보여준다.
    expect(screen.getByRole("alert")).toHaveTextContent("미리보기 화면에 문제가 발생했습니다");
    // 셸(사이드바)은 사라지지 않는다 — 전역 폴백이 아니다.
    expect(screen.getByText("사이드바")).toBeInTheDocument();
    // 전역 폴백 문구는 나타나지 않는다.
    expect(screen.queryByText("문제가 발생했습니다")).not.toBeInTheDocument();
  });

  it("renders children when nothing throws", () => {
    render(
      <FeatureErrorBoundary feature="설정">
        <p>정상 콘텐츠</p>
      </FeatureErrorBoundary>,
    );

    expect(screen.getByText("정상 콘텐츠")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets the boundary when 다시 시도 is clicked", () => {
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error("transient");
      return <p>복구됨</p>;
    }

    render(
      <FeatureErrorBoundary feature="결과물">
        <MaybeBoom />
      </FeatureErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("결과물 화면에 문제가 발생했습니다");

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByText("복구됨")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
