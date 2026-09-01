/** Studio 내부 경로만 로그인 복귀 위치로 허용한다. */
export function getSafeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  // Backslash도 URL parser에서는 authority separator로 해석될 수 있다.
  return new URL(value, window.location.origin).origin === window.location.origin ? value : "/";
}

/** GitHub Pages basename을 포함한 현재 Studio URL을 만든다. */
export function getStudioUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return new URL(`${base}${path.replace(/^\//, "")}`, window.location.origin).toString();
}
