/**
 * 공통 TextInput 컴포넌트.
 *
 * react-hook-form의 register가 ref를 주입할 수 있도록 forwardRef로 구현한다.
 * 오류 상태(invalid)에 따라 테두리 색과 focus 링을 바꾼다.
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 검증 오류 상태. true이면 빨간 테두리와 aria-invalid를 적용한다. */
  invalid?: boolean;
}

/**
 * 스타일과 오류 상태를 갖춘 텍스트 입력 컨트롤.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 transition placeholder:text-zinc-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        "dark:bg-zinc-950 dark:text-zinc-100",
        invalid
          ? "border-red-400 focus-visible:ring-red-500 dark:border-red-700"
          : "border-zinc-300 focus-visible:ring-zinc-500 dark:border-zinc-700",
        className,
      )}
      {...rest}
    />
  );
});
