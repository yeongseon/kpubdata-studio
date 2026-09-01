/**
 * React Router 기반 Studio 라우트 트리를 정의하는 파일.
 *
 * 공통 `Layout` 아래에 홈, 빌드 초안, 검증, 미리보기, 설정 같은 작업실 화면을 배치한다.
 */
import type { ReactElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import { FeatureErrorBoundary, RouteErrorBoundary } from "@/app/ErrorBoundary";
import { Layout } from "@/app/Layout";
import { LoginGate } from "@/features/auth/LoginGate";
import { AddDataPage } from "@/pages/AddDataPage";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
import { BuildArtifactsPage } from "@/pages/BuildArtifactsPage";
import { BuildPublishPage } from "@/pages/BuildPublishPage";
import { BuildRunPage } from "@/pages/BuildRunPage";
import { BuildsPage } from "@/pages/BuildsPage";
import { DatasetCatalogPage } from "@/pages/DatasetCatalogPage";
import { DatasetDetailPage } from "@/pages/DatasetDetailPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { HomePage } from "@/pages/HomePage";
import { KubiPage } from "@/pages/KubiPage";
import { LoginPage } from "@/pages/LoginPage";
import { MonitoringPage } from "@/pages/MonitoringPage";
import { NewBuildPage } from "@/pages/NewBuildPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { ProviderPage } from "@/pages/ProviderPage";
import { QualityPage } from "@/pages/QualityPage";
import { ReportEditorPage } from "@/pages/ReportEditorPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SignupPage } from "@/pages/SignupPage";
import { ValidatePage } from "@/pages/ValidatePage";
import { WorkspacePage } from "@/pages/WorkspacePage";

/**
 * 페이지 요소를 feature 단위 ErrorBoundary로 감싼다 (#97).
 *
 * 한 feature의 렌더 오류가 전역 폴백까지 버블업해 앱 전체(셸 포함)를 빈 화면으로 만들지 않도록,
 * 각 라우트 요소를 해당 영역만 폴백하는 경계로 감싼다. Layout의 `<Outlet />` 안쪽에서 동작하므로
 * 사이드바/헤더는 유지된다.
 *
 * @param feature - 폴백에 노출할 기능 이름.
 * @param element - 보호할 페이지 요소.
 * @returns 경계로 감싼 요소.
 */
function withFeatureBoundary(feature: string, element: ReactElement): ReactElement {
  return <FeatureErrorBoundary feature={feature}>{element}</FeatureErrorBoundary>;
}

/**
 * 브라우저 URL과 Studio 페이지 컴포넌트를 연결하는 전역 라우터.
 *
 * @returns 각 경로별 렌더링 규칙을 담은 브라우저 라우터 인스턴스.
 */
export const router = createBrowserRouter([
    // Login/Signup(#263)은 App Shell(사이드바/헤더) 밖의 독립 화면이라 Layout의 children이
    // 아니라 최상위 형제 라우트로 둔다 — 로그인 전 상태에는 아직 보여줄 워크스페이스 셸이 없다.
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/signup",
      element: <SignupPage />,
    },
    {
      path: "/",
      element: <LoginGate><Layout /></LoginGate>,
      errorElement: <RouteErrorBoundary />,
      children: [
      {
        index: true,
        element: withFeatureBoundary("홈", <HomePage />),
      },
      // 새 IA(#247)의 WORKSPACE 그룹. Discover는 #249에서 구현됨. Workspace는 아직
      // placeholder이며 #260에서 실제 화면으로 교체된다.
      {
        path: "discover",
        element: withFeatureBoundary("Discover", <DiscoverPage />),
      },
      {
        path: "workspace",
        element: withFeatureBoundary("Workspace", <WorkspacePage />),
      },
      // 새 IA의 DATA 그룹. Add Data/Dataset Catalog/Quality는 #250/#253/#254에서 구현된다.
      {
        path: "add",
        element: withFeatureBoundary("Add Data", <AddDataPage />),
      },
      {
        path: "datasets",
        element: withFeatureBoundary("Dataset Catalog", <DatasetCatalogPage />),
      },
      {
        path: "datasets/:datasetId",
        element: withFeatureBoundary("Dataset 상세", <DatasetDetailPage />),
      },
      {
        path: "builds",
        element: withFeatureBoundary("빌드 목록", <BuildsPage />),
      },
      {
        path: "builds/new",
        element: withFeatureBoundary("새 빌드 만들기", <NewBuildPage />),
      },
      {
        path: "quality",
        element: withFeatureBoundary("Quality", <QualityPage />),
      },
      // Build 단위 중심 라우트 (제안 §3.3): 상세 → 편집/실행/결과물/게시.
      // 레거시 딥링크(#255 §5): /builds/:buildId도 동일한 master-detail(BuildsPage)을
      // 열어 canonical form(/builds?run=)과 같은 context를 보여준다.
      {
        path: "builds/:buildId",
        element: withFeatureBoundary("빌드 상세", <BuildsPage />),
      },
      {
        // 편집은 New Build와 동일한 에디터를 재사용한다.
        path: "builds/:buildId/edit",
        element: withFeatureBoundary("빌드 편집", <NewBuildPage />),
      },
      {
        path: "builds/:buildId/run",
        element: withFeatureBoundary("빌드 실행", <BuildRunPage />),
      },
      {
        path: "builds/:buildId/artifacts",
        element: withFeatureBoundary("결과물", <BuildArtifactsPage />),
      },
      {
        path: "builds/:buildId/publish",
        element: withFeatureBoundary("게시", <BuildPublishPage />),
      },
      // 새 IA의 AI 그룹(#256에서 실제 기능 구현). 전역 Kubi drawer는
      // `src/features/kubi/KubiDrawer.tsx`로 Layout 수준에서 별도 mount된다.
      {
        path: "kubi",
        element: withFeatureBoundary("Kubi", <KubiPage />),
      },
      {
        path: "reports",
        element: withFeatureBoundary("Reports", <ReportsPage />),
      },
      {
        path: "reports/:reportId",
        element: withFeatureBoundary("Report 편집", <ReportEditorPage />),
      },
      // 새 IA의 SYSTEM 그룹(#259/#264에서 실제 기능 구현).
      {
        path: "provider",
        element: withFeatureBoundary("Provider", <ProviderPage />),
      },
      {
        path: "monitoring",
        element: withFeatureBoundary("Monitoring", <MonitoringPage />),
      },
      // 레거시 단독 라우트: 내비게이션에서는 제거됐지만 딥링크 호환을 위해 유지한다(#247 결정:
      // 새 IA로 리다이렉트하지 않고 그대로 유지 — Validate/Preview/Artifacts는 New Build
      // Wizard 내부 패널로 통합 예정이며, 통합 시점까지는 기존 화면이 fallback 역할을 한다).
      {
        path: "validate",
        element: withFeatureBoundary("검증", <ValidatePage />),
      },
      {
        path: "preview",
        element: withFeatureBoundary("미리보기", <PreviewPage />),
      },
      {
        path: "artifacts",
        element: withFeatureBoundary("결과물", <ArtifactsPage />),
      },
      {
        path: "settings",
        element: withFeatureBoundary("설정", <SettingsPage />),
      },
    ],
  },
  ],
  {
    // GitHub Pages 하위 경로(/kpubdata-studio/)에서도 라우팅이 동작하도록 base를 basename으로 사용한다.
    basename: import.meta.env.BASE_URL.replace(/\/+$/, "") || "/",
  },
);
