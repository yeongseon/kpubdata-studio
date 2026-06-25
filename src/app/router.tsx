/**
 * React Router 기반 Studio 라우트 트리를 정의하는 파일.
 *
 * 공통 `Layout` 아래에 홈, 빌드 초안, 검증, 미리보기, 설정 같은 작업실 화면을 배치한다.
 */
import { createBrowserRouter } from "react-router-dom";
import { RouteErrorBoundary } from "@/app/ErrorBoundary";
import { Layout } from "@/app/Layout";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
import { BuildArtifactsPage } from "@/pages/BuildArtifactsPage";
import { BuildDetailPage } from "@/pages/BuildDetailPage";
import { BuildPublishPage } from "@/pages/BuildPublishPage";
import { BuildRunPage } from "@/pages/BuildRunPage";
import { BuildsPage } from "@/pages/BuildsPage";
import { HomePage } from "@/pages/HomePage";
import { NewBuildPage } from "@/pages/NewBuildPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ValidatePage } from "@/pages/ValidatePage";

/**
 * 브라우저 URL과 Studio 페이지 컴포넌트를 연결하는 전역 라우터.
 *
 * @returns 각 경로별 렌더링 규칙을 담은 브라우저 라우터 인스턴스.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "builds",
        element: <BuildsPage />,
      },
      {
        path: "builds/new",
        element: <NewBuildPage />,
      },
      // Build 단위 중심 라우트 (제안 §3.3): 상세 → 편집/실행/결과물/게시.
      {
        path: "builds/:buildId",
        element: <BuildDetailPage />,
      },
      {
        // 편집은 New Build와 동일한 에디터를 재사용한다.
        path: "builds/:buildId/edit",
        element: <NewBuildPage />,
      },
      {
        path: "builds/:buildId/run",
        element: <BuildRunPage />,
      },
      {
        path: "builds/:buildId/artifacts",
        element: <BuildArtifactsPage />,
      },
      {
        path: "builds/:buildId/publish",
        element: <BuildPublishPage />,
      },
      // 레거시 단독 라우트: 내비게이션에서는 제거됐지만 딥링크 호환을 위해 유지한다.
      // Validate/Preview는 New Build Wizard 내부 패널로 통합 예정(§5.3/§5.4).
      {
        path: "validate",
        element: <ValidatePage />,
      },
      {
        path: "preview",
        element: <PreviewPage />,
      },
      {
        path: "artifacts",
        element: <ArtifactsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
