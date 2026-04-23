import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders scaffold quick actions", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: /build public-data workflows with a shell students can extend safely/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create a new build/i })).toBeVisible();
  });
});
