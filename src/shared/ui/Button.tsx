/**
 * 공통 Button 컴포넌트.
 *
 * 페이지마다 반복되던 Tailwind 버튼 스타일을 variant/size/loading 상태로 통일한다.
 * 접근성을 위해 focus-visible 링과 disabled/loading 시 상호작용 차단을 기본 제공한다.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시각적 강조 수준을 결정하는 변형 */
  variant?: ButtonVariant;
  /** 버튼 크기 */
  size?: ButtonSize;
  /** 로딩 상태. true이면 스피너를 표시하고 클릭을 막는다. */
  loading?: boolean;
  /** 라벨 앞에 표시할 아이콘 등 */
  leadingIcon?: ReactNode;
}

/**
 * 일관된 스타일과 상태를 가진 버튼을 렌더링한다.
 *
 * @param props - 표준 button 속성에 variant/size/loading/leadingIcon을 더한 값.
 * @returns 버튼 엘리먼트.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonClassName(
        variant,
        size,
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );
}
