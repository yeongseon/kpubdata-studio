import { render, screen } from "@testing-library/react";
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
  it("renders the build detail page with the buildId from the route", () => {
    renderAt("/builds/air-quality", <BuildDetailPage />);
    expect(screen.getByRole("heading", { name: "air-quality" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /편집/ })).toHaveAttribute(
      "href",
      "/builds/air-quality/edit",
    );
  });

  it("renders the run page with progress steps", () => {
    renderAt("/builds/abc/run", <BuildRunPage />);
    expect(screen.getByText("진행 단계")).toBeInTheDocument();
    expect(screen.getByText("수집")).toBeInTheDocument();
  });

  it("renders the artifacts page with a manifest section", () => {
    renderAt("/builds/abc/artifacts", <BuildArtifactsPage />);
    expect(screen.getByText("Manifest 요약")).toBeInTheDocument();
  });

  it("renders the publish page with destination options", () => {
    renderAt("/builds/abc/publish", <BuildPublishPage />);
    expect(screen.getByText("HuggingFace Dataset")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /게시/ })).toBeDisabled();
  });
});
