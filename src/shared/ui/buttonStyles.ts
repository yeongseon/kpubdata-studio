/**
 * Button과 LinkButton이 공유하는 시각 스타일 정의.
 *
 * 버튼과 "버튼처럼 보이는 링크"가 동일한 variant/size 룩을 갖도록 클래스 합성 로직을
 * 한곳에 모은다. 이렇게 분리하면 `<button>` 안에 `<a>`를 중첩하지 않고도(상호작용 요소
 * 중첩 회피) 링크를 버튼 스타일로 렌더링할 수 있다.
 */
import { cn, type ClassValue } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-sm hover:brightness-110 active:brightness-95",
  secondary:
    "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-500",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

/**
 * variant/size에 맞는 버튼 스타일 className을 만든다.
 *
 * @param variant - 강조 수준.
 * @param size - 크기.
 * @param extra - 추가로 합성할 클래스 값들.
 * @returns 합쳐진 className 문자열.
 */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  ...extra: ClassValue[]
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    ...extra,
  );
}
