import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the existing-user dashboard heading and KPI summary once builds load (#248)", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // mock 빌드 이력에 성공한 빌드가 있어 기존 사용자 대시보드(ExistingUserHome)가 렌더된다.
    expect(
      await screen.findByRole("heading", {
        name: "작업 현황을 한눈에 확인하세요",
      }),
    ).toBeInTheDocument();
    // 상태 요약 KPI 카드 라벨
    expect(screen.getByText("DATASETS")).toBeInTheDocument();
    expect(screen.getByText("BUILD SUCCESS")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("loads recent builds from the mock builder data", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // 데모 빌드 이력이 최근 빌드 목록에 표시된다.
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
    // 각 빌드 행에서 상세로 이동하는 링크가 있다.
    expect(
      screen.getAllByRole("link", { name: "보기" }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
