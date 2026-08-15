/**
 * Kubi 참고 노트 큐 → Report 반영 승인 패널 (#258 §7).
 *
 * `features/kubi/reportInbox.ts`(#256)에 쌓인, 사용자가 Kubi 채팅에서 이미 한 번
 * 승인한 노트를 보여준다. 여기서 다시 한번: note 원문 → 연결 evidence(문맥) →
 * 현재 Report의 기준 dataset/run과 같은지 → 사용자 승인 순서를 거친 뒤에만 Report에
 * KUBI_INTERPRETATION 블록으로 추가한다. 자동으로 추가되지 않는다.
 */
import { useEffect, useState } from "react";
import { listKubiReportNotes, removeKubiReportNote, type KubiReportNote } from "@/features/kubi/reportInbox";
import { Card, EmptyState } from "@/shared/ui";
import { noteMatchesReportContext, reportNoteToBlock } from "../kubiBlocks";
import type { KubiInterpretationBlock, ReportDraft } from "../types";

export function KubiInboxPanel({
  report,
  onApprove,
  onNotesChanged,
}: {
  report: Pick<ReportDraft, "datasetId" | "baseRunId">;
  onApprove: (block: KubiInterpretationBlock) => void;
  /** 승인/무시로 큐가 바뀔 때마다 호출된다(Report Context sidebar의 대기 노트 수 갱신용). */
  onNotesChanged?: () => void;
}) {
  const [notes, setNotes] = useState<KubiReportNote[]>([]);

  useEffect(() => {
    setNotes(listKubiReportNotes());
  }, []);

  function approve(note: KubiReportNote) {
    onApprove(reportNoteToBlock(note, report));
    removeKubiReportNote(note);
    setNotes(listKubiReportNotes());
    onNotesChanged?.();
  }

  function discard(note: KubiReportNote) {
    removeKubiReportNote(note);
    setNotes(listKubiReportNotes());
    onNotesChanged?.();
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">대기 중인 Kubi 노트</p>
      {notes.length === 0 ? (
        <EmptyState
          className="py-6"
          title="대기 중인 Kubi 노트가 없습니다"
          description="Kubi 대화에서 '보고서에 추가' action을 승인하면 여기에 쌓입니다."
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {notes.map((note, index) => {
            const sameContext = noteMatchesReportContext(note, report);
            return (
              <li key={`${note.savedAt}-${index}`} className="rounded-lg border border-border p-3 text-sm">
                <p className="text-foreground">{note.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[note.context.datasetId, note.context.runId, note.context.stage].filter(Boolean).join(" · ") ||
                    "문맥 없음"}
                  {" · "}
                  {new Date(note.savedAt).toLocaleString("ko-KR")}
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${sameContext ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                >
                  {sameContext ? "현재 Report와 같은 dataset/run 기준" : "현재 Report와 다른 dataset/run 기준 · 참고 분석으로 추가됨"}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => approve(note)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    이 Report에 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(note)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    무시
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
