/**
 * 저장된 Report의 기준 evidence 상태(CURRENT/STALE/ORPHAN/UNAVAILABLE)를 알린다 (#258 §8).
 *
 * 어떤 상태여도 저장된 Report 내용을 지우거나 자동으로 최신 run으로 바꾸지 않는다 —
 * 이 배너는 상태를 알리고, STALE일 때만 "새 Report 만들기" 진입점을 보여준다.
 */
import { Card } from "@/shared/ui";
import type { EvidenceStalenessResult } from "../staleness";

const COPY: Record<EvidenceStalenessResult["status"], { title: string; tone: "default" | "warn" | "error" }> = {
  current: { title: "CURRENT — 기준 run이 최신 상태입니다.", tone: "default" },
  stale: { title: "STALE — 기준 run은 유효하지만 더 새로운 Run이 있습니다.", tone: "warn" },
  orphan: { title: "ORPHAN — 기준 run을 더 이상 찾을 수 없습니다(삭제되었거나 접근 불가).", tone: "error" },
  unavailable: { title: "UNAVAILABLE — evidence를 다시 확인하지 못했습니다.", tone: "warn" },
};

const TONE_CLASS: Record<"default" | "warn" | "error", string> = {
  default: "border-border bg-card",
  warn: "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  error: "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
};

export function EvidenceStatusBanner({
  result,
  loading,
  onRecheck,
  onCreateFromLatest,
}: {
  result: EvidenceStalenessResult | null;
  loading: boolean;
  onRecheck: () => void;
  onCreateFromLatest?: () => void;
}) {
  if (loading) {
    return (
      <Card className="flex items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
        <span>기준 evidence를 다시 확인하는 중…</span>
      </Card>
    );
  }
  if (!result) return null;

  const copy = COPY[result.status];
  return (
    <Card className={`flex flex-wrap items-center justify-between gap-3 border py-3 text-sm ${TONE_CLASS[copy.tone]}`}>
      <div>
        <p className="font-medium">{copy.title}</p>
        {result.reason ? <p className="mt-0.5 text-xs text-muted-foreground">{result.reason}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRecheck}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          다시 확인
        </button>
        {result.status === "stale" && onCreateFromLatest ? (
          <button
            type="button"
            onClick={onCreateFromLatest}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            최신 Run으로 새 Report 만들기
          </button>
        ) : null}
      </div>
    </Card>
  );
}
