/**
 * 공통 StatusBadge 컴포넌트.
 *
 * draft/run/publish 흐름의 모든 상태값을 한국어 라벨 + 일관된 색상으로 표시한다.
 * 색상만으로 의미를 전달하지 않도록 항상 텍스트 라벨을 함께 노출한다(접근성).
 */
import { cn } from "./cn";

/** Studio 전반에서 배지로 표시 가능한 모든 상태값의 합집합 */
export type StatusValue =
  | "new"
  | "draft"
  | "dirty"
  | "validated"
  | "invalid"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "publishing"
  | "published";

interface StatusMeta {
  /** 화면에 노출할 한국어 라벨 */
  label: string;
  /** Tailwind 색상 클래스 */
  className: string;
}

const STATUS_META: Record<StatusValue, StatusMeta> = {
  new: { label: "새 초안", className: "bg-muted text-muted-foreground" },
  draft: { label: "초안", className: "bg-muted text-muted-foreground" },
  dirty: { label: "수정됨", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  validated: { label: "검증됨", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  invalid: { label: "오류 있음", className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  queued: { label: "대기 중", className: "bg-muted text-muted-foreground" },
  running: { label: "실행 중", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  succeeded: { label: "성공", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  failed: { label: "실패", className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  cancelled: { label: "취소됨", className: "bg-muted text-muted-foreground" },
  publishing: { label: "게시 중", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  published: { label: "게시됨", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

/** 알 수 없는 상태값에 사용할 중립 배지 스타일 */
const FALLBACK_META: StatusMeta = {
  label: "",
  className: "bg-muted text-muted-foreground",
};

export interface StatusBadgeProps {
  /**
   * 표시할 상태값.
   *
   * 알려진 `StatusValue`면 해당 라벨/색상으로, 그 외 임의 문자열이면 원본 라벨을 가진
   * 중립 배지로 안전하게 표시한다(매핑 누락 시 크래시 방지).
   */
  status: StatusValue | (string & {});
  /** 추가 className */
  className?: string;
}

/**
 * 상태값에 대응하는 한국어 라벨과 색상을 가진 배지를 렌더링한다.
 *
 * 알 수 없는 상태값은 원본 문자열을 라벨로 사용하는 중립 배지로 폴백한다.
 *
 * @param props - status와 추가 className.
 * @returns 상태 배지 엘리먼트.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const known = STATUS_META[status as StatusValue] as StatusMeta | undefined;
  const meta = known ?? { ...FALLBACK_META, label: status };
  const isLive = status === "running" || status === "publishing";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {isLive ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {meta.label}
    </span>
  );
}
