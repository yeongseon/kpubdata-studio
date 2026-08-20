/**
 * 로그인 화면 (/login, #263).
 *
 * 실제 IdP 연결은 Builder #515 결정 이후로 미루고, 지금은 mock/demo AuthProvider로
 * 이메일/비밀번호 로그인 UX와 generic AuthProvider 경계를 시연한다. 기존 Google 로그인
 * 플로우(#187, GoogleLoginButton/gis.ts)는 건드리지 않는다 — 이 화면은 별도의
 * mockAuthProvider를 통해 같은 세션 store(useAuthStore)에 로그인한다.
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mockAuthProvider } from "@/features/auth/mockAuthProvider";
import { useAuthStore } from "@/features/auth/store";
import { AuthError } from "@/features/auth/types";
import { Button, Card, ErrorMessage, FormField, TextInput } from "@/shared/ui";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          KPubData Studio에 로그인하세요. (mock/demo — 실제 계정 인증은 아직 연결되지 않았습니다.)
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
            계정 만들기
          </Link>
        </p>
      </Card>
    </main>
  );
}
