/**
 * Reports 화면 (`/reports`) — placeholder (#247), Kubi 참고 노트 큐 표시만 추가 (#256).
 *
 * 실제 리포트 생성/편집 구현은 #258에서 진행한다. 여기서는 그 전체 기능을 대신 만들지 않고,
 * Kubi의 ADD_REPORT_BLOCK 승인 결과가 어디로 가는지(`features/kubi/reportInbox.ts`)만
 * 읽기 전용으로 보여준다 — #258이 실제 편집 기능을 붙일 때 이 큐를 소비하면 된다.
 */
import { useEffect, useState } from "react";
import { listKubiReportNotes, type KubiReportNote } from "@/features/kubi/reportInbox";
import { Card, EmptyState, PageHeader } from "@/shared/ui";

export function ReportsPage() {
  const [notes, setNotes] = useState<KubiReportNote[]>([]);

  useEffect(() => {
    setNotes(listKubiReportNotes());
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Reports"
        title="리포트"
        description="Kubi 분석 결과와 인사이트를 리포트로 기록하고 공유합니다."
      />

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kubi 참고 노트 대기열
        </p>
        {notes.length === 0 ? (
          <EmptyState
            className="py-8"
            title="대기 중인 Kubi 노트가 없습니다"
            description="Kubi 대화에서 '보고서에 추가' action을 승인하면 여기에 쌓입니다."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {notes.map((note, index) => (
              <li key={index} className="rounded-lg border border-border p-3 text-sm">
                <p className="text-foreground">{note.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[note.context.datasetId, note.context.runId, note.context.stage].filter(Boolean).join(" · ") || "문맥 없음"}
                  {" · "}
                  {new Date(note.savedAt).toLocaleString("ko-KR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="dashed" className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-lg font-medium tracking-tight">아직 준비 중인 화면입니다</p>
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
          리포트 편집·발행 기능은 #258에서 구현됩니다. 위 대기열은 그때 실제 리포트 문서에
          반영됩니다.
        </p>
      </Card>
    </main>
  );
}
