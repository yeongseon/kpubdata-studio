import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildPublishPage } from "@/pages/BuildPublishPage";
import { mswServer } from "../vitest.setup";

const BUILDER_BASE = "http://localhost:8000";

afterEach(() => vi.unstubAllEnvs());

function renderPublish(runId: string) {
  return render(
    <MemoryRouter initialEntries={[`/builds/${runId}/publish`]}>
      <Routes>
        <Route path="/builds/:buildId/publish" element={<BuildPublishPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BuildPublishPage readiness (audit #4)", () => {
  it("mock 모드에서 실제 네트워크 요청 없이 결정적 readiness를 보여준다 (이전에는 항상 빈 카드/error였다)", async () => {
    renderPublish("air-quality-20260621");

    expect(await screen.findByText("Builder 게시 준비 완료")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mock 모드에서 not-ready run은 실제 blocker 내용을 보여준다", async () => {
    renderPublish("dur-older-adult-caution-20260618");

    expect(await screen.findByText("Builder blocker가 있어 게시할 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByText(/Bronze stage가 실패해/)).toBeInTheDocument();
  });

  it("ready:false인데 blockers가 비어 있으면 'blocker가 있다'고 잘못 단정하지 않는다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    mswServer.use(
      http.get(`${BUILDER_BASE}/builds/:runId/publish/readiness`, ({ params }) =>
        HttpResponse.json({
          run_id: String(params.runId),
          target: "huggingface",
          ready: false,
          blockers: [],
          warnings: [],
        }),
      ),
    );

    renderPublish("some-real-run");

    expect(
      await screen.findByText(/구체적인 사유\(blocker\)를 제공하지 않았습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Builder blocker가 있어 게시할 수 없습니다.")).not.toBeInTheDocument();
  });
});
