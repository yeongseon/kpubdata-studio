/**
 * Google Identity Services (GIS) 로더 (S2, #187).
 *
 * GIS 스크립트를 동적으로 로드하고 초기화한다.
 * 콜백의 credential이 곧 Builder에 보낼 ID token JWT (별도 토큰 교환 없음).
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: IdConfig) => void;
          renderButton: (parent: HTMLElement, options: ButtonOptions) => void;
          disableAutoSelect: () => void;
          prompt: (listener?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

interface IdConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
  auto_select?: boolean;
}

interface ButtonOptions {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
}

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let _loaded = false;

export function loadGisScript(): Promise<void> {
  if (_loaded && window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(check);
          _loaded = true;
          resolve();
        }
      }, 100);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script"));
    document.head.appendChild(script);
  });
}

export function decodeJwtEmail(jwt: string): string | null {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export function googleLogout(): void {
  window.google?.accounts?.id?.disableAutoSelect();
}
