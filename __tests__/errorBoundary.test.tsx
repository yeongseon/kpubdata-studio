import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, RouteErrorBoundary } from "@/app/ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary (#81)", () => {
  beforeEach(() => {
    // React/Router가 잡힌 오류를 콘솔에 찍는 것을 테스트 출력에서 숨긴다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fallback when a child throws during render", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("문제가 발생했습니다");
    expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>정상 콘텐츠</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("정상 콘텐츠")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the fallback as a route errorElement when a route throws", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <Boom />,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole("alert")).toHaveTextContent("문제가 발생했습니다");
  });
});
