/**
 * Google 로그인 버튼 (S2, #187).
 *
 * GIS 스크립트를 로드하고, VITE_GOOGLE_CLIENT_ID로 초기화한다.
 * 콜백의 credential(JWT)을 auth store에 저장한다 — Builder Bearer 토큰으로 직접 사용.
 * VITE_GOOGLE_CLIENT_ID 미설정 시 아무것도 렌더링하지 않는다 (mock 모드).
 */
import { useEffect, useRef } from "react";
import { useAuthStore } from "./store";
import { decodeJwtEmail, loadGisScript } from "./gis";

export function GoogleLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setToken = useAuthStore((s) => s.setToken);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadGisScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            const email = decodeJwtEmail(response.credential);
            setToken(response.credential, email);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        });
      })
      .catch(() => {
        // GIS 로드 실패 — 버튼이 렌더링되지 않음. 사용자에게 에러 표시는 S8에서.
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, setToken]);

  if (!clientId) return null;

  return <div ref={containerRef} />;
}
