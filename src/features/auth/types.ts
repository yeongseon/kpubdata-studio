/**
 * Generic 인증 계약 (#263).
 *
 * Google GIS(#187)든, Builder #515에서 결정될 email/password OIDC든 이 계약 뒤에서
 * 갈아끼울 수 있게 만든 provider-agnostic 타입이다. 실제 IdP 연결(JWKS/refresh/Builder
 * bearer 토큰 정책)은 #515 결정 이후로 미루고, 지금은 mock/demo provider로만 이 계약을
 * 구현한다.
 */

/** 어떤 provider가 이 세션을 만들었는지 표시하는 태그. */
export type AuthProviderId = "google" | "mock" | "keycloak";

/**
 * 로그인 성공 후 Studio가 들고 있는 세션 정보.
 *
 * password는 절대 이 shape에 포함하지 않는다 — 어떤 provider도 세션에 원문 비밀번호를
 * 담아서는 안 된다(#263 보안 요구사항: password를 store/localStorage/sessionStorage/
 * 로그 어디에도 남기지 않음).
 */
export interface AuthSession {
  /** Builder 호출용 Bearer 토큰(또는 mock 모드에서는 그 자리를 채우는 mock 토큰). */
  token: string;
  email: string;
  /** 표시용 이름. Google 로그인은 이름을 제공하지 않으므로 null(#191 topbar avatar와 호환). */
  name: string | null;
  provider: AuthProviderId;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type AccountType = "individual" | "organization";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
  /** 팀·기관(accountType === "organization") 선택 시에만 의미 있는 optional 값. */
  organizationName?: string;
}

/** 로그인/가입 실패를 다른 예외(네트워크 오류 등)와 구분하기 위한 전용 에러 타입. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * email/password(또는 향후 다른 OIDC) 인증을 수행하는 provider의 generic 계약.
 *
 * Google GIS는 이 인터페이스를 구현하지 않는다 — GIS SDK는 위젯을 렌더링하고 콜백으로
 * credential을 돌려주는 방식이라(`gis.ts`/`GoogleLoginButton.tsx` 참고)
 * `signIn(email, password)` 같은 직접 호출 형태와 맞지 않는다. 대신 Google도 결과적으로
 * 같은 {@link AuthSession} shape을 세션 store(`useAuthStore`)에 넣으므로, 두 로그인
 * 방식은 세션 모델 층에서 하나로 합쳐진다 — topbar avatar/Settings/LoginGate는 어느
 * provider로 로그인했는지 신경 쓰지 않는다.
 *
 * Builder #515에서 실제 IdP가 결정되면, 이 인터페이스를 구현하는 real provider가
 * mock provider 자리를 그대로 대체한다.
 */
export interface AuthProvider {
  readonly id: AuthProviderId;
  signIn(input: SignInInput): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signOut(): Promise<void>;
}
