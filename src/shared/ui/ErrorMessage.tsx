/**
 * 공통 ErrorMessage 컴포넌트.
 *
 * 폼 필드 오류나 요약 오류를 role="alert"로 노출해 보조기기가 즉시 안내하도록 한다
 * (접근성, 제안 §12).
 */
import { cn } from "./cn";

export interface ErrorMessageProps {
  /** aria-describedby로 연결하기 위한 id */
  id?: string;
  /** 오류 메시지 본문 */
  children?: React.ReactNode;
  /** 추가 className */
  className?: string;
}

/**
 * 오류 메시지를 role="alert"로 렌더링한다. children이 없으면 아무것도 렌더링하지 않는다.
 *
 * @param props - id/children/className.
 * @returns 오류 메시지 엘리먼트 또는 null.
 */
export function ErrorMessage({ id, children, className }: ErrorMessageProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-sm text-red-600 dark:text-red-400", className)}
    >
      {children}
    </p>
  );
}
