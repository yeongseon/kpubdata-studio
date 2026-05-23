/**
 * React Router 기반 Studio 라우트 트리를 정의하는 파일.
 *
 * 공통 `Layout` 아래에 홈, 빌드 초안, 검증, 미리보기, 설정 같은 작업실 화면을 배치한다.
 */
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
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
