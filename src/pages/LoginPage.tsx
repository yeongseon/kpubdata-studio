/**
 * 로그인 화면 (/login, #263; OIDC 연동에서 실제 Keycloak 로그인 진입점 추가).
 *
 * 실제 IdP는 kpubdata-builder ADR 0015가 self-hosted Keycloak + Authorization Code +
 * PKCE(S256)로 확정했다. 이 화면은 환경에 따라 분기한다:
 * - mock/demo 환경(`!isRealBuilderEnabled()`): 기존 mockAuthProvider 이메일/비밀번호
 *   폼을 그대로 유지한다(dev/demo 전용).
 * - 실연동 + OIDC 활성: Keycloak 로그인 리다이렉트 버튼만 제공한다. 이메일/비밀번호,
 *   비밀번호 재설정, 이메일 인증은 모두 Keycloak 책임이므로 Studio는 입력 폼을 두지 않는다.
 * - 실연동 + OIDC 미구성/오류: 안내만 보여준다 — 가짜 redirect/token flow를 만들지 않는다.
 *
 * 기존 Google 로그인 플로우(#187, GoogleLoginButton/gis.ts)는 건드리지 않는다.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { keycloakLogin } from "@/features/auth/keycloak";
import { getSafeReturnTo } from "@/features/auth/returnTo";
import { mockAuthProvider } from "@/features/auth/mockAuthProvider";
import { useAuthStore } from "@/features/auth/store";
import { AuthError } from "@/features/auth/types";
import { getOidcConfig } from "@/shared/config/env";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { Button, Card, DemoBadge, ErrorMessage, FormField, TextInput } from "@/shared/ui";

/** Auth 화면에 표시하는 짧은 제품 소개. */
function ProductIntro() {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">KPubData</h1>
      <p className="mt-1 text-sm text-muted-foreground">공공데이터를 AI-ready Dataset으로</p>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const oidcStatus = useAuthStore((state) => state.oidcStatus);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await mockAuthProvider.signIn({ email, password });
      setSession(session);
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof AuthError ? cause.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const demoMode = !isRealBuilderEnabled();
  const oidc = getOidcConfig();
  const returnTo = getSafeReturnTo(new URLSearchParams(location.search).get("returnTo"));

  // 이미 Keycloak 세션이 확인되면 앱으로 돌려보낸다(로그인 화면에 머물지 않게).
  useEffect(() => {
    if (!demoMode && oidcStatus === "authenticated") {
      navigate(returnTo, { replace: true });
    }
  }, [demoMode, oidcStatus, navigate, returnTo]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <ProductIntro />
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">로그인</h2>
            {demoMode ? <DemoBadge /> : null}
          </div>

          {demoMode ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                KPubData Studio에 로그인하세요. mock/demo 계정입니다.
              </p>

              <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
                <FormField id="login-email" label="이메일" required>
                  {(field) => (
                    <TextInput
                      {...field}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  )}
                </FormField>

                <FormField id="login-password" label="비밀번호" required>
                  {(field) => (
                    <TextInput
                      {...field}
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  )}
                </FormField>

                <ErrorMessage>{error}</ErrorMessage>

                <Button type="submit" loading={isSubmitting} className="mt-2">
                  로그인
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                계정이 없으신가요?{" "}
                <Link to="/signup" className="font-medium text-accent-subtle-foreground underline">
                  계정 발급 안내
                </Link>
              </p>
            </>
          ) : oidcStatus === "initializing" ? (
            <p className="mt-4 text-sm text-muted-foreground">로그인 상태를 확인하는 중입니다.</p>
          ) : oidcStatus === "error" ? (
            <ErrorMessage>인증 초기화에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.</ErrorMessage>
          ) : oidc.status === "ok" ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Google 로그인과 KPubData 계정 로그인은 모두 Keycloak에서 안전하게 처리됩니다.
              </p>
              <Button
                type="button"
                leadingIcon={<span aria-hidden="true" className="font-semibold">G</span>}
                onClick={() => void keycloakLogin(returnTo, "google")}
              >
                Google로 계속하기
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                또는
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="secondary" onClick={() => void keycloakLogin(returnTo)}>
                KPubData 계정으로 로그인
              </Button>
            </div>
          ) : oidc.status === "error" ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">OIDC 인증 설정에 문제가 있습니다.</p>
              <p className="mt-2">
                이 환경은 실제 Builder에 연결되어 있지만 OIDC 설정(<code>VITE_OIDC_ISSUER</code> /{" "}
                <code>VITE_OIDC_CLIENT_ID</code>)이 올바르지 않습니다. 관리자에게 문의하세요.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">OIDC 인증이 아직 구성되지 않았습니다.</p>
              <p className="mt-2">
                이 환경은 실제 Builder에 연결되어 있지만, 사람 사용자 로그인을 위한 OIDC IdP(Keycloak)
                연동이 아직 준비되지 않았습니다. 관리자에게 문의하거나 연동이 완료된 이후 다시
                시도해주세요.
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
