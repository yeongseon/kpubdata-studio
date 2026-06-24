/**
 * 공통 Skeleton 컴포넌트 (제안 §11).
 *
 * 데이터 로딩 중 콘텐츠 자리를 펄스 애니메이션 블록으로 채운다. 보조기기에는
 * aria-hidden으로 숨긴다(상태 안내는 로딩 텍스트가 담당).
 */
import { cn } from "./cn";

export interface SkeletonProps {
  /** 추가 className(크기/모양 지정) */
  className?: string;
}

/**
 * 단일 펄스 블록을 렌더링한다.
 *
 * @param props - className.
 * @returns 스켈레톤 블록.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)}
    />
  );
}

export interface SkeletonTableProps {
  /** 행 수 */
  rows?: number;
  /** 추가 className */
  className?: string;
}

/**
 * 표 로딩용 스켈레톤 행 묶음을 렌더링한다.
 *
 * @param props - rows/className.
 * @returns 스켈레톤 행 목록.
 */
export function SkeletonTable({ rows = 3, className }: SkeletonTableProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-3 p-6", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}
