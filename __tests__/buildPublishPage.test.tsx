import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildPublishPage } from "@/pages/BuildPublishPage";
import { API_BASE } from "@/shared/config/env";
import { mswServer } from "../vitest.setup";

// builderApi가 실제로 쓰는 API base와 동일하게 파생한다(하드코딩된 host에 종속되지 않도록).
const BUILDER_BASE = API_BASE;

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

  it("?dataset= 없이 exact run_id만으로 들어와도 Dataset identity와 Build 완료를 표시한다", async () => {
    // 이전에는 URL에 ?dataset=이 없으면 Dataset/Build 완료가 "확인되지 않음"이었다
    // (Builds/Runs·Artifacts·딥링크 진입 경로 전부). 이제 canonical run 해석으로 채운다.
    renderPublish("air-quality-20260621");

    const runCard = (await screen.findByText("선택한 Run")).closest("div");
    expect(runCard).toHaveTextContent("대기오염 정보");
    expect(runCard).toHaveTextContent("완료");
    expect(runCard).not.toHaveTextContent("확인되지 않음");
  });

  it("Run마다 자기 Dataset identity를 표시하고 다른 Run과 섞이지 않는다", async () => {
    renderPublish("dur-older-adult-caution-20260618");

    const runCard = (await screen.findByText("선택한 Run")).closest("div");
    expect(runCard).toHaveTextContent("노인주의 의약품");
    expect(runCard).not.toHaveTextContent("대기오염 정보");
    expect(runCard).toHaveTextContent("dur-older-adult-caution-20260618");
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
