/**
 * 로그인 화면 (/login, #263).
 *
 * 실제 IdP는 kpubdata-builder ADR 0015(Accepted)가 self-hosted Keycloak +
 * Authorization Code + PKCE로 확정했지만, Studio에 아직 실제 Keycloak
 * provider/callback/token 연동 코드가 없다(keycloak/PKCE 관련 구현 전무 확인). 그래서
 * 이 화면은 `isRealBuilderEnabled()`(mock/demo vs 실제 Builder 연동)로 분기한다:
 * - mock/demo 환경: 기존 mockAuthProvider 이메일/비밀번호 폼을 그대로 유지한다(dev/demo 전용).
 * - 실제 Builder 연동인데 Keycloak이 아직 없는 환경: mock 폼을 실제 인증처럼 보여주지 않고
 *   "OIDC 인증 미구성" 안내만 보여준다 — 가짜 Keycloak redirect/token flow를 만들지 않는다.
 *
 * 기존 Google 로그인 플로우(#187, GoogleLoginButton/gis.ts)는 건드리지 않는다 — 이 화면은
 * 별도의 mockAuthProvider를 통해 같은 세션 store(useAuthStore)에 로그인한다.
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mockAuthProvider } from "@/features/auth/mockAuthProvider";
import { useAuthStore } from "@/features/auth/store";
import { AuthError } from "@/features/auth/types";
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
  const setSession = useAuthStore((state) => state.setSession);
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
      navigate("/", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof AuthError ? cause.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const demoMode = !isRealBuilderEnabled();

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
