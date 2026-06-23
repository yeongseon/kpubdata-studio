/**
 * 두 BuildSpec의 차이를 시각적으로 보여주는 컴포넌트 (#13, v0.3 MVP).
 *
 * diffSpecs 결과를 추가(초록)/삭제(빨강)/변경(노랑) 행으로 렌더링한다. 변경 없으면
 * "차이 없음" 안내를 보여준다.
 */
import { diffSpecs, type SpecChangeKind } from "@/features/build-spec/specDiff";
import type { BuildSpec } from "@/shared/lib/types";
import { EmptyState } from "@/shared/ui";

const KIND_META: Record<SpecChangeKind, { label: string; className: string; sign: string }> = {
  added: {
    label: "추가",
    className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    sign: "+",
  },
  removed: {
    label: "삭제",
    className: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    sign: "−",
  },
  changed: {
    label: "변경",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    sign: "~",
  },
};

export interface SpecDiffProps {
  /** 이전 스펙 */
  before: BuildSpec;
  /** 이후 스펙 */
  after: BuildSpec;
}

/**
 * 두 스펙의 필드 단위 차이를 목록으로 렌더링한다.
 *
 * @param props - before/after 스펙.
 * @returns 스펙 diff 엘리먼트.
 */
export function SpecDiff({ before, after }: SpecDiffProps) {
  const changes = diffSpecs(before, after);

  if (changes.length === 0) {
    return <EmptyState title="두 스펙에 차이가 없습니다" />;
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {changes.map((change) => {
        const meta = KIND_META[change.kind];
        return (
          <li key={change.path} className="flex flex-wrap items-center gap-3 px-1 py-2 text-sm">
            <span
              className={`inline-flex w-12 justify-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
            >
              {meta.sign} {meta.label}
            </span>
            <span className="font-mono text-zinc-700 dark:text-zinc-200">{change.path}</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {change.kind === "changed" ? (
                <>
                  <span className="line-through">{change.before}</span> → {change.after}
                </>
              ) : change.kind === "added" ? (
                change.after
              ) : (
                <span className="line-through">{change.before}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
