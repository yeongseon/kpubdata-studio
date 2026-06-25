/**
 * 애플리케이션 전역 Provider를 조립하는 최상위 앱 컴포넌트.
 *
 * 현재는 React Router를 연결해 모든 페이지가 동일한 라우팅 컨텍스트를 공유하도록 만든다.
 */
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";

/**
 * Studio 전체를 Router 컨텍스트로 감싸는 루트 컴포넌트.
 *
 * @returns 전역 Provider가 적용된 라우터 렌더링 결과.
 */
export function App() {
  return <RouterProvider router={router} />;
}
