/**
 * 계정 발급 안내 화면 (/signup, #263 → #Phase2 UI polish).
 *
 * kpubdata-builder ADR 0015(Accepted) §5는 public signup을 기본 OFF로 하고 관리자
 * 초대/이메일 도메인 제한을 기본 정책으로 둔다. 이전에는 이 라우트가 완전히 동작하는
 * 자체 회원가입 폼(mockAuthProvider.signUp)을 열어 두고 있었는데, 이는 실제 정책(공개
 * 자율 가입 없음)과 어긋난다. 실제 Keycloak 연동도 아직 없으므로(LoginPage 주석 참고)
 * 여기서는 정책만 정직하게 안내하고, 구체적인 계정 발급 방식(관리자 초대 UI, 이메일
 * 도메인 검증 등)은 아직 구현되지 않았으므로 확정된 사실처럼 서술하지 않는다.
 */
import { Link } from "react-router-dom";
import { Card } from "@/shared/ui";

export function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">계정 발급 안내</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          KPubData Studio는 공개 회원가입을 제공하지 않습니다. 계정 발급 방식은 조직 정책에 따라
          관리자가 안내합니다.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          비밀번호, 이메일 인증, 비밀번호 재설정은 KPubData 계정(Keycloak)에서 관리됩니다 —
          Studio는 비밀번호를 입력받거나 저장하지 않습니다.
        </p>
        <Link to="/login" className="mt-6 inline-block font-medium text-accent-subtle-foreground underline">
          로그인하러 가기
        </Link>
      </Card>
    </main>
  );
}
