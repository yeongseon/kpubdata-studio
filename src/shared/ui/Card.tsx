/**
 * 공통 Card 컴포넌트.
 *
 * 페이지마다 반복되던 `rounded-[2rem] border ... bg-white/80 shadow-lg` 패턴을
 * variant로 통일한다.
 */
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "elevated" | "dashed" | "error" | "success";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 카드의 시각적 변형 */
  variant?: CardVariant;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default:
    "border border-zinc-200/80 bg-white/80 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/70",
  elevated:
    "border border-zinc-200/80 bg-white shadow-xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-950",
  dashed:
    "border-2 border-dashed border-zinc-300 bg-transparent dark:border-zinc-700",
  error:
    "border border-red-300 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/30",
  success:
    "border border-emerald-300 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30",
};

/**
 * 표준 패딩과 모서리를 가진 카드 컨테이너를 렌더링한다.
 *
 * @param props - 표준 div 속성에 variant를 더한 값.
 * @returns 카드 엘리먼트.
 */
export function Card({ variant = "default", className, children, ...rest }: CardProps) {
  return (
    <div className={cn("rounded-[2rem] p-6", VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </div>
  );
}
