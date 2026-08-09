/**
 * 인증 상태 관리 (S3, #188).
 *
 * 토큰은 메모리(zustand store)에만 보관한다 — persist 미들웨어 사용 금지.
 * localStorage/sessionStorage에 토큰을 쓰면 XSS 한 번으로 탈취된다.
 * 새로고침 시 재로그인(GIS 자동 로그인으로 마찰 완화 예정, S2/#187).
 */
import { create } from "zustand";

interface AuthState {
  /** Builder로 보낼 Bearer 토큰 (Google ID token JWT). null이면 미로그인. */
  token: string | null;
  /** 로그인된 사용자 이메일 (UI 표시용, S6/#191). */
  email: string | null;
  /** 토큰을 설정한다 (GIS 로그인 콜백에서 호출, S2/#187). */
  setToken: (token: string | null, email?: string | null) => void;
  /** 로그아웃 — 토큰 폐기. */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  email: null,
  setToken: (token, email = null) => set({ token, email }),
  clear: () => set({ token: null, email: null }),
}));

/**
 * apiFetch에 전달할 토큰 provider (S1/#186 과 연결).
 * 메모리 store에서 읽어 반환한다 — 전역 변수 직접 참조보다 테스트가 쉽다.
 */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
