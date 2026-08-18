/**
 * 로그인 게이트 (S5, #190).
 *
 * 실연동 모드(VITE_USE_REAL_BUILDER=true)에서만 로그인을 요구한다.
 * mock 모드(Pages 데모 포함)에서는 게이트 없이 children을 렌더링한다.
 * 데모가 깨지지 않는 것이 핵심 — 리뷰 시 Pages 데모 동작 확인 필수.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { useAuthStore } from "./store";

export function LoginGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);

  if (!isRealBuilderEnabled()) {
    return <>{children}</>;
  }

  if (!token) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20">
        <p className="text-lg font-semibold text-foreground">로그인이 필요합니다</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          실연동 모드에서는 Builder API 호출을 위해 로그인이 필요합니다.
        </p>
        <Link to="/login" className="text-sm font-medium text-accent-subtle-foreground underline">
          로그인 페이지로 이동
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
