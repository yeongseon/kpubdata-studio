/**
 * 공통 EmptyState 컴포넌트.
 *
 * "무엇이 없는지 + 다음 행동 제안 + CTA" 구조로 빈 상태를 일관되게 표현한다(제안 §11).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** 비어 있는 이유를 요약한 제목 */
  title: string;
  /** 사용자가 할 수 있는 다음 행동 설명 */
  description?: ReactNode;
  /** CTA 버튼 라벨 */
  actionLabel?: string;
  /** CTA 이동 경로(내부 라우트). actionLabel과 함께 사용. */
  actionHref?: string;
  /** 경로 대신 클릭 핸들러로 동작시킬 때 사용 */
  onAction?: () => void;
  /** 상단 아이콘/일러스트 */
  icon?: ReactNode;
  /** 추가 className */
  className?: string;
}

/**
 * 데이터가 없을 때 안내 문구와 다음 행동 CTA를 보여준다.
 *
 * @param props - title/description/action 관련 속성.
 * @returns 빈 상태 엘리먼트.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-zinc-400 dark:text-zinc-500">{icon}</div> : null}
      <p className="text-lg font-medium tracking-tight">{title}</p>
      {description ? (
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      ) : null}
      {actionLabel ? (
        <div className="mt-6">
          {actionHref ? (
            <Link
              to={actionHref}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition",
                "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
              )}
            >
              {actionLabel}
            </Link>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
