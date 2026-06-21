import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
import { BuildsPage } from "@/pages/BuildsPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ValidatePage } from "@/pages/ValidatePage";

function renderPage(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("remaining pages", () => {
  it("BuildsPage shows the Korean heading and an empty-state CTA", () => {
    renderPage(<BuildsPage />);
    expect(screen.getByRole("heading", { name: "빌드 목록" })).toBeInTheDocument();
    expect(screen.getByText("아직 생성된 빌드가 없습니다")).toBeInTheDocument();
  });

  it("SettingsPage shows the API base URL section", () => {
    renderPage(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "환경 설정" })).toBeInTheDocument();
    expect(screen.getByText("Builder API 엔드포인트")).toBeInTheDocument();
  });

  it("ArtifactsPage guides to the build list", () => {
    renderPage(<ArtifactsPage />);
    expect(screen.getByRole("link", { name: "빌드 목록으로" })).toHaveAttribute("href", "/builds");
  });

  it("legacy Validate/Preview pages route into the wizard", () => {
    renderPage(<ValidatePage />);
    expect(screen.getByRole("link", { name: "새 빌드 만들기" })).toHaveAttribute(
      "href",
      "/builds/new",
    );
    renderPage(<PreviewPage />);
    expect(screen.getAllByRole("link", { name: "새 빌드 만들기" }).length).toBeGreaterThanOrEqual(1);
  });
});
