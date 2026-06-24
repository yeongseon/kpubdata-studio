import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState, Skeleton, SkeletonTable } from "@/shared/ui";

describe("ErrorState (#11)", () => {
  it("renders the message as an alert and triggers retry", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="네트워크 오류" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 오류");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button when no handler is given", () => {
    render(<ErrorState message="오류" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Skeleton (#11)", () => {
  it("renders a pulse block hidden from assistive tech", () => {
    const { container } = render(<Skeleton className="h-6 w-20" />);
    const block = container.firstChild as HTMLElement;
    expect(block).toHaveClass("animate-pulse");
    expect(block).toHaveAttribute("aria-hidden", "true");
  });

  it("SkeletonTable renders the requested number of rows", () => {
    const { container } = render(<SkeletonTable rows={5} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });
});
