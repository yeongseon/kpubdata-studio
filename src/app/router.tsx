/**
 * React Router 기반 Studio 라우트 트리를 정의하는 파일.
 *
 * 공통 `Layout` 아래에 홈, 빌드 초안, 검증, 미리보기, 설정 같은 작업실 화면을 배치한다.
 */
import type { ReactElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import { FeatureErrorBoundary, RouteErrorBoundary } from "@/app/ErrorBoundary";
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
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: withFeatureBoundary("홈", <HomePage />),
      },
      {
        path: "builds",
        element: withFeatureBoundary("빌드 목록", <BuildsPage />),
      },
      {
        path: "builds/new",
        element: withFeatureBoundary("새 빌드 만들기", <NewBuildPage />),
      },
      // Build 단위 중심 라우트 (제안 §3.3): 상세 → 편집/실행/결과물/게시.
      {
        path: "builds/:buildId",
        element: withFeatureBoundary("빌드 상세", <BuildDetailPage />),
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
      // 레거시 단독 라우트: 내비게이션에서는 제거됐지만 딥링크 호환을 위해 유지한다.
      // Validate/Preview는 New Build Wizard 내부 패널로 통합 예정(§5.3/§5.4).
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
]);
