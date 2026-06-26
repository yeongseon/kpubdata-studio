/**
 * 애플리케이션 전역 Provider를 조립하는 최상위 앱 컴포넌트.
 *
 * 현재는 React Router를 연결해 모든 페이지가 동일한 라우팅 컨텍스트를 공유하도록 만든다.
 */
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { router } from "@/app/router";
import { useThemeEffect } from "@/shared/hooks/useThemeEffect";

/**
 * Studio 전체를 Router 컨텍스트로 감싸는 루트 컴포넌트.
 *
 * 전역 ErrorBoundary로 감싸 렌더 중 throw가 SPA 전체를 빈 화면으로 만들지 않게 한다(#81).
 * 저장된 테마를 문서에 적용해 light/dark 선택이 실제 UI에 반영되게 한다(#96).
 *
 * @returns 전역 Provider가 적용된 라우터 렌더링 결과.
 */
export function App() {
  useThemeEffect();
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
