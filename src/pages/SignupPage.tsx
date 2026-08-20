/**
 * 계정 만들기 화면 (/signup, #263).
 *
 * 실제 IdP 연결은 Builder #515 결정 이후로 미루고, 지금은 mock/demo AuthProvider로
 * 회원가입 UX와 generic AuthProvider 경계를 시연한다. 가입 성공 시 곧바로 로그인 세션을
 * 만들지 않고 email verification 안내만 보여준다 — 실제 인증 메일 발송/검증(자체 mail
 * server)은 이슈 스코프 밖이며 Builder #515 이후 real IdP가 담당한다.
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { mockAuthProvider } from "@/features/auth/mockAuthProvider";
import type { AccountType } from "@/features/auth/types";
import { Button, Card, ErrorMessage, FormField, TextInput } from "@/shared/ui";

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await mockAuthProvider.signUp({
        name,
        email,
        password,
        accountType,
        organizationName:
          accountType === "organization" && organizationName ? organizationName : undefined,
      });
      // 계정은 생성됐지만 실제 email verification 전까지는 로그인 세션을 만들지 않는다.
      setCreatedEmail(session.email);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "계정을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">이메일을 확인해주세요</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{createdEmail}</span>로 인증 링크를
            보냈습니다. (mock/demo 모드에서는 실제 이메일이 발송되지 않습니다.)
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block font-medium text-accent-subtle-foreground underline"
          >
            로그인하러 가기
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">계정 만들기</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          KPubData Studio 계정을 만드세요. (mock/demo — 실제 계정 인증은 아직 연결되지 않았습니다.)
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormField id="signup-name" label="이름" required>
            {(field) => (
              <TextInput
                {...field}
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FormField>

          <FormField id="signup-email" label="이메일" required>
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

          <FormField id="signup-password" label="비밀번호" required>
            {(field) => (
              <TextInput
                {...field}
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">계정 유형</legend>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="accountType"
                value="individual"
                checked={accountType === "individual"}
                onChange={() => setAccountType("individual")}
              />
              개인
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="accountType"
                value="organization"
                checked={accountType === "organization"}
                onChange={() => setAccountType("organization")}
              />
              팀 · 기관
            </label>
          </fieldset>

          {accountType === "organization" ? (
            <FormField id="signup-org" label="기관/팀명" help="선택 입력입니다.">
              {(field) => (
                <TextInput
                  {...field}
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                />
              )}
            </FormField>
          ) : null}

          <ErrorMessage>{error}</ErrorMessage>

          <Button type="submit" loading={isSubmitting} className="mt-2">
            계정 만들기
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="font-medium text-accent-subtle-foreground underline">
            로그인
          </Link>
        </p>
      </Card>
    </main>
  );
}
