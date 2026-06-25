/**
 * 앱 전역 React ErrorBoundary와 공통 오류 폴백 UI (#81).
 *
 * 렌더 중 발생한 예외가 SPA 전체를 빈 화면으로 만들지 않도록, 클래스 컴포넌트
 * `ErrorBoundary`가 하위 트리의 throw를 잡아 한국어 폴백 화면(새로고침 동작 포함)을
 * 보여준다. 동일한 폴백을 라우터 `errorElement`에서도 재사용한다.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router-dom";

/**
 * 오류 발생 시 보여줄 한국어 폴백 화면.
 *
 * @returns 새로고침 동작이 포함된 오류 안내 UI.
 */
export function ErrorFallback() {
  return (
    <main
      role="alert"
      className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        문제가 발생했습니다
      </p>
      <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        예기치 못한 오류로 화면을 표시할 수 없습니다. 페이지를 새로고침하면 대부분 해결됩니다.
        문제가 계속되면 잠시 후 다시 시도해주세요.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        새로고침
      </button>
    </main>
  );
}

/**
 * 라우터 `errorElement`로 사용하는 오류 화면.
 *
 * 라우트 로더/액션/렌더 오류를 콘솔에 남기고 공통 폴백을 보여준다.
 *
 * @returns 오류 폴백 UI.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error("Route error:", error);
  return <ErrorFallback />;
}

interface ErrorBoundaryProps {
  /** 보호할 하위 트리 */
  children: ReactNode;
}

interface ErrorBoundaryState {
  /** 하위 트리에서 예외가 발생했는지 여부 */
  hasError: boolean;
}

/**
 * 하위 트리의 렌더 예외를 잡아 폴백 UI로 대체하는 앱 전역 ErrorBoundary.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
