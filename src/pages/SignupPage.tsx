/** 공개 회원가입은 Studio가 아닌 Keycloak hosted UI에서 처리한다. */
import { Link, useLocation } from "react-router-dom";
import { keycloakLogin } from "@/features/auth/keycloak";
import { getSafeReturnTo } from "@/features/auth/returnTo";
import { getOidcConfig } from "@/shared/config/env";
import { Button, Card } from "@/shared/ui";

export function SignupPage() {
  const location = useLocation();
  const oidc = getOidcConfig();
  const returnTo = getSafeReturnTo(new URLSearchParams(location.search).get("returnTo"));

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">KPubData 계정 만들기</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          회원가입, 이메일 인증, 비밀번호 정책은 안전한 Keycloak 화면에서 처리합니다.
        </p>
        {oidc.status === "ok" ? (
          <Button className="mt-6" onClick={() => void keycloakLogin(returnTo)}>
            Keycloak에서 회원가입 또는 로그인
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">인증 설정이 준비되면 여기서 계정을 만들 수 있습니다.</p>
        )}
        <Link to="/login" className="mt-6 inline-block font-medium text-accent-subtle-foreground underline">
          로그인으로 돌아가기
        </Link>
      </Card>
    </main>
  );
}
