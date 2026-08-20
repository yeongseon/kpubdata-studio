/**
 * 인증 상태 관리 (S3/#188, #263에서 generic 세션으로 확장).
 *
 * 토큰은 메모리(zustand store)에만 보관한다 — persist 미들웨어 사용 금지.
 * localStorage/sessionStorage에 토큰을 쓰면 XSS 한 번으로 탈취된다.
 * 새로고침 시 재로그인(GIS 자동 로그인으로 마찰 완화 예정, S2/#187).
 *
 * #263: Google(setToken)과 mock/email 로그인(setSession)이 이 store 하나를 공유해
 * topbar avatar(#191)/Settings/LoginGate(#190)가 어느 provider로 로그인했는지 신경 쓰지
 * 않고 동일하게 동작하게 한다. setToken은 기존 GoogleLoginButton 호출부를 그대로 유지하기
 * 위한 하위 호환 진입점이다(signature 변경 없음).
 */
import { create } from "zustand";
import type { AuthProviderId, AuthSession } from "./types";

interface AuthState {
  /** Builder로 보낼 Bearer 토큰 (Google ID token JWT 또는 mock 토큰). null이면 미로그인. */
  token: string | null;
  /** 로그인된 사용자 이메일 (UI 표시용, S6/#191). */
  email: string | null;
  /** 표시용 이름. Google 로그인은 이름을 제공하지 않아 null(#263). */
  name: string | null;
  /** 이 세션을 만든 provider. 미로그인이면 null(#263). */
  providerId: AuthProviderId | null;
  /** 토큰을 설정한다 (GIS 로그인 콜백에서 호출, S2/#187) — provider는 항상 "google"로 기록한다. */
  setToken: (token: string | null, email?: string | null) => void;
  /** generic {@link AuthProvider}(mock/#263)가 반환한 세션을 그대로 저장한다. */
  setSession: (session: AuthSession) => void;
  /** 로그아웃 — 세션 전체를 폐기. */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  email: null,
  name: null,
  providerId: null,
  setToken: (token, email = null) =>
    set({ token, email, name: null, providerId: token ? "google" : null }),
  setSession: (session) =>
    set({
      token: session.token,
      email: session.email,
      name: session.name,
      providerId: session.provider,
    }),
  clear: () => set({ token: null, email: null, name: null, providerId: null }),
}));

/**
 * apiFetch에 전달할 토큰 provider (S1/#186 과 연결).
 * 메모리 store에서 읽어 반환한다 — 전역 변수 직접 참조보다 테스트가 쉽다.
 */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
