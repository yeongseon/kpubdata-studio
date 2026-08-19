import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BuildArtifactsPage } from "@/pages/BuildArtifactsPage";
import { BuildDetailPage } from "@/pages/BuildDetailPage";
import { BuildPublishPage } from "@/pages/BuildPublishPage";
import { BuildRunPage } from "@/pages/BuildRunPage";

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/builds/:buildId" element={element} />
        <Route path="/builds/:buildId/run" element={element} />
        <Route path="/builds/:buildId/artifacts" element={element} />
        <Route path="/builds/:buildId/publish" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("build-centric routes", () => {
  it("renders the build detail page with data for the buildId from the route", async () => {
    // 라우트 파라미터가 실제 조회에 쓰이는지 확인하기 위해 mock 이력에 존재하는 id를 쓴다.
    renderAt("/builds/air-quality-20260621", <BuildDetailPage />);
    // BuildDetailPage는 비동기로 데이터를 로드하므로 로딩이 완료될 때까지 기다린다.
    await waitFor(() => {
      // 조회된 스펙의 제목이 표시되고,
      expect(screen.getByRole("heading", { name: "대기오염 정보" })).toBeInTheDocument();
    });
    // 어떤 실행인지 식별할 수 있도록 run id도 함께 노출된다.
    expect(screen.getByText(/air-quality-20260621/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /편집/ })).toHaveAttribute(
      "href",
      "/builds/air-quality-20260621/edit",
    );
    // manifest 요약(#155 살벤지)도 상세 화면에 함께 렌더된다.
    expect(await screen.findByText("Manifest 요약")).toBeInTheDocument();
  });

  it("shows an error instead of placeholder data for an unknown buildId", async () => {
    renderAt("/builds/does-not-exist", <BuildDetailPage />);
    // 존재하지 않는 빌드를 실제 데이터처럼 보여주면 안 된다 (#119, #120).
    expect(await screen.findByText(/빌드를 찾을 수 없습니다/)).toBeInTheDocument();
  });

  it("renders the run page with progress steps", () => {
    renderAt("/builds/abc/run", <BuildRunPage />);
    expect(screen.getByText("진행 단계")).toBeInTheDocument();
    expect(screen.getByText("수집")).toBeInTheDocument();
  });

  it("renders the artifacts page with a manifest section", async () => {
    renderAt("/builds/abc/artifacts", <BuildArtifactsPage />);
    // manifest는 비동기로 로드되므로 로드 후 요약이 나타난다.
    expect(await screen.findByText("Manifest 요약")).toBeInTheDocument();
    expect(screen.getByText(/12,304/)).toBeInTheDocument();
  });

  it("renders the real publish page with only the supported Hugging Face target", () => {
    renderAt("/builds/abc/publish", <BuildPublishPage />);
    expect(screen.getByText("Hugging Face")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "최종 확인" })).toBeDisabled();
    expect(screen.queryByText(/Kaggle|Local only/)).not.toBeInTheDocument();
  });
});
