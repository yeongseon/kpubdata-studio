import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the Korean dashboard heading and status summary", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: /공공데이터 수집부터 결과물 생성까지 한 번에 관리하세요/,
      }),
    ).toBeInTheDocument();
    // 상태 요약 카드 라벨
    expect(screen.getByText("초안")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument();
  });

  it("shows an empty state with a CTA to create the first build", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("아직 생성된 빌드가 없습니다")).toBeInTheDocument();
    // 빠른 시작 카드의 새 빌드 링크
    expect(
      screen.getAllByRole("link", { name: /새 빌드 만들기/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
