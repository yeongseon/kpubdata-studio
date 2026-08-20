/**
 * 최소 accessible disclosure(접기/펼치기) 패턴 (#255 §3).
 *
 * secondary evidence(Run Events, BuildSpec snapshot처럼 핵심 판정을 대체하지 않는 부가 정보)를
 * 기본 collapsed로 두되, 키보드/스크린리더로도 펼칠 수 있게 실제 `<button>` + `aria-expanded`만
 * 쓴다. 새 accordion 라이브러리를 추가하지 않는다.
 */
import { useId, useState, type ReactNode } from "react";

export interface DisclosureProps {
  /** 접힌 상태에서도 항상 보이는 제목(카운트 등 확정된 값만 포함, 추측 금지). */
  title: ReactNode;
  /** 초기 펼침 여부. 기본 false(collapsed) — Pipeline/Quality처럼 항상 펼쳐야 하는 primary 정보에는 쓰지 않는다. */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/** button + aria-expanded만으로 구성된 단순 disclosure. 펼쳤을 때만 children을 렌더링한다. */
export function Disclosure({ title, defaultOpen = false, children, className }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold"
      >
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {open ? "▼" : "▶"}
        </span>
        {title}
      </button>
      {open ? (
        <div id={contentId} className="mt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
