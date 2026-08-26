import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BuildRunPage } from "@/pages/BuildRunPage";

function renderRun(buildId: string) {
  return render(
    <MemoryRouter initialEntries={[`/builds/${buildId}/run`]}>
      <Routes>
        <Route path="/builds/:buildId/run" element={<BuildRunPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BuildRunPage (audit #3)", () => {
  it("shows the build's actual canonical status (running), not a hardcoded 대기 placeholder", async () => {
    // dur-pregnancy-taboo-20260621는 mock 빌드 이력에서 status: "running"이다 — Builds
    // 목록에서 running으로 보이는 run을 열었을 때 이 화면이 항상 "대기"로 보이던 모순을 재현한다.
    renderRun("dur-pregnancy-taboo-20260621");

    expect(await screen.findByText("실행 중")).toBeInTheDocument();
    expect(screen.queryByText("대기 중")).not.toBeInTheDocument();
  });

  it("shows the build's actual canonical status (failed), not a hardcoded 대기 placeholder", async () => {
    renderRun("dur-older-adult-caution-20260618");

    expect(await screen.findByText("실패")).toBeInTheDocument();
    expect(screen.queryByText("대기 중")).not.toBeInTheDocument();
  });

  it("does not fabricate stage-by-stage progress it cannot support", async () => {
    renderRun("dur-pregnancy-taboo-20260621");

    await screen.findByText("실행 중");
    expect(screen.getByText("상세 진행 정보 미지원")).toBeInTheDocument();
  });
});
