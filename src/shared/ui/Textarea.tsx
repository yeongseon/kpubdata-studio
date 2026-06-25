/**
 * 공통 Textarea 컴포넌트.
 *
 * TextInput과 동일한 스타일 체계를 따르며 react-hook-form ref 주입을 위해 forwardRef로 구현한다.
 */
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 검증 오류 상태. true이면 빨간 테두리와 aria-invalid를 적용한다. */
  invalid?: boolean;
  /** true이면 monospace 글꼴을 적용한다(JSON 등 코드 입력용). 기본은 본문 글꼴. */
  mono?: boolean;
}

/**
 * 스타일과 오류 상태를 갖춘 멀티라인 입력 컨트롤.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, mono, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 transition placeholder:text-zinc-400",
        mono && "font-mono",
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
