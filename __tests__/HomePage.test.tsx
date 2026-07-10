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
    // 상태 요약 카드 라벨(실행 상태 기반)
    expect(screen.getByText("실행 중")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument();
  });

  it("loads recent builds from the mock builder data", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // 데모 빌드 이력이 최근 빌드 목록에 표시된다.
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
    // 빠른 시작 카드의 새 빌드 링크
    expect(
      screen.getAllByRole("link", { name: /새 빌드 만들기/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
