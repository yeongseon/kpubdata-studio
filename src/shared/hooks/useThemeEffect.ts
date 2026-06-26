/**
 * 저장된 테마 모드를 실제 DOM에 적용하는 이펙트 훅 (#96).
 *
 * `useUIStore`는 테마 값(`system | light | dark`)을 localStorage에 저장하지만, 그 값을
 * 문서에 반영하는 코드가 없었다. 이 훅은 `<html>`의 `data-theme` 속성을 갱신해
 * `globals.css`의 테마별 CSS 변수와 Tailwind `dark:` 변형(`@custom-variant dark`)을 활성화한다.
 *
 * - `light` / `dark`: `data-theme`를 해당 값으로 설정한다.
 * - `system`: `data-theme`를 제거해 `prefers-color-scheme`에 위임하고, OS 테마 변경을
 *   실시간으로 따라가도록 미디어 쿼리 변화를 구독한다.
 */
import { useEffect } from "react";
import { useUIStore } from "@/shared/hooks/useUIStore";

/** 선택된 테마 모드를 `<html data-theme>`에 반영한다. system이면 속성을 제거한다. */
function applyTheme(theme: "system" | "light" | "dark"): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/**
 * 저장된 테마를 문서에 적용하고 system 모드에서 OS 테마 변경을 따라간다.
 *
 * 앱 루트에서 한 번 호출한다(중복 호출해도 무해하지만 불필요하다).
 */
export function useThemeEffect(): void {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    // system 모드: OS 테마가 바뀌면 즉시 반영되도록 prefers-color-scheme를 구독한다.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);
}
