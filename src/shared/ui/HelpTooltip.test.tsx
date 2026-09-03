import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpTooltip } from "./HelpTooltip";

describe("HelpTooltip", () => {
  it("hover, focus, click으로 열고 Escape로 닫으며 ARIA로 설명을 연결한다", () => {
    render(<HelpTooltip content="Run 설명" />);
    const trigger = screen.getByRole("button", { name: "도움말" });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Run 설명");
    expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
