/**
 * 공통 PageHeader 컴포넌트.
 *
 * 각 페이지 상단에서 반복되던 "eyebrow 라벨 + 제목 + 설명 + 우측 액션" 패턴을 통일한다.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PageHeaderProps {
  /** 제목 위에 표시할 작은 대문자 라벨(예: "Runs") */
  eyebrow?: string;
  /** 페이지 제목 */
  title: string;
  /** 제목 아래 보조 설명 */
  description?: ReactNode;
  /** 우측 정렬 액션 영역(버튼 등) */
  actions?: ReactNode;
  /** 추가 className */
  className?: string;
}

/**
 * 페이지 머리말(라벨/제목/설명/액션)을 일관된 레이아웃으로 렌더링한다.
 *
 * @param props - eyebrow/title/description/actions.
 * @returns 페이지 헤더 엘리먼트.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-300">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
