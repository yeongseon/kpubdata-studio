/**
 * Kubi 참고 노트 → Report KUBI_INTERPRETATION 블록 변환 (#258 §6, §7).
 *
 * `ADD_REPORT_BLOCK`은 이미 #256에서 구현·승인되어 `features/kubi/reportInbox.ts` 큐에
 * 쌓인다. 새 action contract를 만들지 않고 그 큐를 그대로 소비한다. 여기서 다시 한번
 * 사용자 승인을 요구한다(#258 §7의 5단계: note 표시 → evidence 표시 → context 비교 →
 * 사용자 승인 → 블록 추가) — Kubi 채팅에서의 승인은 "참고 노트 큐에 넣는 것"까지고, 이
 * Report에 실제로 반영할지는 별도 승인 단계다.
 */
import type { KubiReportNote } from "@/features/kubi/reportInbox";
import type { KubiInterpretationBlock, ReportDraft } from "./types";

/** 큐의 note context가 이 Report의 기준 dataset/run과 같은 문맥인지 비교한다. */
export function noteMatchesReportContext(note: KubiReportNote, report: Pick<ReportDraft, "datasetId" | "baseRunId">): boolean {
  return note.context.datasetId === report.datasetId && note.context.runId === report.baseRunId;
}

function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `kubi-${crypto.randomUUID()}`;
  return `kubi-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 승인된 Kubi 참고 노트를 KUBI_INTERPRETATION 블록으로 변환한다.
 *
 * 다른 dataset/run에서 만든 note라도 그대로 추가할 수 있게 하되(#258 §7 — 완전히 막지는
 * 않음), `isSameContext=false`로 남겨 UI가 "참고 분석 · 다른 Run 기준"으로 명확히
 * 구분해서 보여줄 수 있게 한다. 정본 분석처럼 합치지 않는다.
 */
export function reportNoteToBlock(note: KubiReportNote, report: Pick<ReportDraft, "datasetId" | "baseRunId">): KubiInterpretationBlock {
  const now = new Date().toISOString();
  return {
    id: newBlockId(),
    provenance: "KUBI_INTERPRETATION",
    note: note.note,
    reason: note.reason,
    sourceContext: note.context,
    isSameContext: noteMatchesReportContext(note, report),
    generatedAt: note.savedAt,
    createdAt: now,
    updatedAt: now,
  };
}
