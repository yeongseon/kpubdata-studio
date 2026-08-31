/**
 * 로그인 게이트 (S5, #190; OIDC 연동에서 실제 Keycloak 세션으로 확장).
 *
 * mock 모드(Pages 데모 포함)와 명시적 dev bypass에서는 게이트 없이 children을 렌더링한다.
 * 데모/E2E가 깨지지 않는 것이 핵심 — 리뷰 시 Pages 데모 동작 확인 필수.
 *
 * 실연동 모드에서는:
 * - OIDC 활성: keycloak 부트스트랩 상태(initializing/authenticated/unauthenticated/error)로 분기.
 * - OIDC 미구성(disabled): 기존 정책 유지 — 메모리 토큰이 있으면 통과, 없으면 /login 안내.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isDevAuthBypassEnabled } from "@/shared/config/env";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { keycloakLogin } from "./keycloak";
import { useAuthStore } from "./store";

function CenteredNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20">
      {children}
    </div>
  );
}

export function LoginGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const oidcStatus = useAuthStore((s) => s.oidcStatus);

  if (!isRealBuilderEnabled() || isDevAuthBypassEnabled()) {
    return <>{children}</>;
  }

  if (oidcStatus === "disabled") {
    if (token) return <>{children}</>;
    return (
      <CenteredNotice>
        <p className="text-lg font-semibold text-foreground">로그인이 필요합니다</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          실연동 모드에서는 Builder API 호출을 위해 로그인이 필요합니다.
        </p>
        <Link to="/login" className="text-sm font-medium text-accent-subtle-foreground underline">
          로그인 페이지로 이동
        </Link>
      </CenteredNotice>
    );
  }

  if (oidcStatus === "initializing") {
    return (
      <CenteredNotice>
        <p className="text-sm text-muted-foreground">로그인 상태를 확인하는 중입니다…</p>
      </CenteredNotice>
    );
  }

  if (oidcStatus === "error") {
    return (
      <CenteredNotice>
        <p className="text-lg font-semibold text-foreground">인증을 초기화하지 못했습니다</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          OIDC 인증 서비스에 연결하지 못했습니다. 설정을 확인하거나 관리자에게 문의하세요.
        </p>
      </CenteredNotice>
    );
  }

  if (oidcStatus === "authenticated") {
    return <>{children}</>;
  }

  // unauthenticated
  return (
    <CenteredNotice>
      <p className="text-lg font-semibold text-foreground">로그인이 필요합니다</p>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        KPubData 계정으로 로그인하면 Builder 연동 기능을 사용할 수 있습니다.
      </p>
      <button
        type="button"
        onClick={() => void keycloakLogin()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
      >
        Keycloak으로 로그인
      </button>
    </CenteredNotice>
  );
}
