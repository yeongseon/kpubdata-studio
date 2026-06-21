/**
 * 공통 EmptyState 컴포넌트.
 *
 * "무엇이 없는지 + 다음 행동 제안 + CTA" 구조로 빈 상태를 일관되게 표현한다(제안 §11).
 * CTA는 실제 동작(actionHref 또는 onAction)이 있을 때만 노출되며, 타입 차원에서도
 * actionLabel은 둘 중 하나와 함께만 지정할 수 있도록 제한한다.
 */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { LinkButton } from "./LinkButton";
import { cn } from "./cn";

// actionLabel은 반드시 actionHref(라우팅) 또는 onAction(핸들러)과 함께만 허용한다.
type EmptyStateAction =
  | { actionLabel: string; actionHref: string; onAction?: never }
  | { actionLabel: string; actionHref?: never; onAction: () => void }
  | { actionLabel?: never; actionHref?: never; onAction?: never };

export type EmptyStateProps = {
  /** 비어 있는 이유를 요약한 제목 */
  title: string;
  /** 사용자가 할 수 있는 다음 행동 설명 */
  description?: ReactNode;
  /** 상단 아이콘/일러스트 */
  icon?: ReactNode;
  /** 추가 className */
  className?: string;
} & EmptyStateAction;

/**
 * 데이터가 없을 때 안내 문구와 (선택적) 다음 행동 CTA를 보여준다.
 *
 * @param props - title/description/icon과 actionLabel+actionHref|onAction.
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
  const hasAction = Boolean(actionLabel) && (Boolean(actionHref) || Boolean(onAction));

  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-zinc-400 dark:text-zinc-500">{icon}</div> : null}
      <p className="text-lg font-medium tracking-tight">{title}</p>
      {description ? (
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      ) : null}
      {hasAction ? (
        <div className="mt-6">
          {actionHref ? (
            <LinkButton to={actionHref} size="lg">
              {actionLabel}
            </LinkButton>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
