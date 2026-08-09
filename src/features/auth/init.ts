/**
 * 인증 초기화 — auth store를 apiFetch의 토큰 provider에 연결한다 (S1↔S3).
 * 앱 진입점(main.tsx)에서 한 번 호출한다.
 */
import { setAuthErrorCallback, setAuthTokenProvider } from "@/shared/lib/builderApi";
import { useAuthStore } from "./store";

export function initAuth(): void {
  setAuthTokenProvider(() => useAuthStore.getState().token);
  setAuthErrorCallback(() => useAuthStore.getState().clear());
}
