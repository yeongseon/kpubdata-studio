/**
 * 공통 Select 컴포넌트.
 *
 * Provider/Dataset/데이터 단위 등 선택 입력을 통일한다. react-hook-form ref 주입을
 * 위해 forwardRef로 구현한다. 옵션은 children(<option>)으로 전달한다.
 */
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** 검증 오류 상태. true이면 빨간 테두리와 aria-invalid를 적용한다. */
  invalid?: boolean;
}

/**
 * 스타일과 오류 상태를 갖춘 select 컨트롤.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        invalid
          ? "border-red-400 focus-visible:ring-red-500 dark:border-red-700"
          : "border-input focus-visible:ring-ring",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
