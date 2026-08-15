import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AddDataPage } from "@/pages/AddDataPage";
import { DatasetCatalogPage } from "@/pages/DatasetCatalogPage";
import { DatasetDetailPage } from "@/pages/DatasetDetailPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { KubiPage } from "@/pages/KubiPage";
import { MonitoringPage } from "@/pages/MonitoringPage";
import { ProviderPage } from "@/pages/ProviderPage";
import { QualityPage } from "@/pages/QualityPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { WorkspacePage } from "@/pages/WorkspacePage";

function renderPage(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("새 IA placeholder 화면 (#247)", () => {
  it.each([
    [<DiscoverPage />, "데이터 탐색"],
    [<WorkspacePage />, "작업대"],
    [<AddDataPage />, "데이터 추가"],
    [<DatasetCatalogPage />, "데이터셋 카탈로그"],
    [<QualityPage />, "품질 센터"],
    [<KubiPage />, "Kubi AI Assistant"],
    [<ReportsPage />, "리포트"],
    [<ProviderPage />, "Provider"],
    [<MonitoringPage />, "모니터링"],
  ])("renders its title and a 준비 중 안내 without crashing", (element, title) => {
    renderPage(element);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("아직 준비 중인 화면입니다")).toBeInTheDocument();
  });

  it("Add Data placeholder links back to the working New Build wizard", () => {
    renderPage(<AddDataPage />);
    expect(screen.getByRole("link", { name: "새 빌드 만들기" })).toHaveAttribute(
      "href",
      "/builds/new",
    );
  });

  it("Dataset Detail shows the datasetId from the route param", () => {
    render(
      <MemoryRouter initialEntries={["/datasets/air-quality"]}>
        <Routes>
          <Route path="/datasets/:datasetId" element={<DatasetDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "데이터셋: air-quality" }),
    ).toBeInTheDocument();
  });
});
