/**
 * Report Context sidebar (`/reports/:reportId`, #258 IA 개편).
 *
 * 실제로 이 Report에 존재하는 값만 보여준다 — Prototype SSOT의 "Quality summary ON / Schema
 * drift ON / Lineage ON / Analysis ideas ON" 같은 데모용 토글은 대응하는 기능이 없으므로
 * 옮기지 않는다. Evidence 상태 판정/재확인 로직은 기존 `EvidenceStatusBanner`를 그대로
 * 재사용한다(새로 만들지 않음).
 */
import { formatDateTime } from "@/features/datasets/model";
import { Card } from "@/shared/ui";
import type { EvidenceStalenessResult } from "../staleness";
import type { BuilderEvidenceBlock, ReportDraft } from "../types";
import { EvidenceStatusBanner } from "./EvidenceStatusBanner";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ReportContextSidebar({
  report,
  staleness,
  stalenessLoading,
  onRecheck,
  onCreateFromLatest,
  kubiBlockCount,
  pendingKubiNoteCount,
}: {
  report: ReportDraft;
  staleness: EvidenceStalenessResult | null;
  stalenessLoading: boolean;
  onRecheck: () => void;
  onCreateFromLatest?: () => void;
  kubiBlockCount: number;
  pendingKubiNoteCount: number;
}) {
  const qualityBlock = report.blocks.find(
    (block): block is BuilderEvidenceBlock => block.provenance === "BUILDER_EVIDENCE" && block.section === "quality",
  );
  const qualityCounts = qualityBlock?.qualityCounts;

  const sourceKeys = [...new Set(report.evidenceRefs.filter((ref) => ref.kind === "stage").map((ref) => ref.id))];

  return (
    <aside className="flex flex-col gap-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Context</p>
        <div className="mt-2 divide-y divide-border">
          <Row label="Dataset" value={report.datasetId} />
          <Row label="Base Run" value={report.baseRunId} />
          {sourceKeys.length > 0 ? <Row label="Source" value={sourceKeys.join(", ")} /> : null}
          <Row label="BuildSpec digest" value={report.buildSpecDigest ?? "N/A"} />
          <Row label="Evidence 조회 시각" value={formatDateTime(report.evidenceFetchedAt)} />
        </div>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence Status</p>
        <EvidenceStatusBanner
          result={staleness}
          loading={stalenessLoading}
          onRecheck={onRecheck}
          onCreateFromLatest={onCreateFromLatest}
        />
      </div>

      {qualityCounts ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality</p>
          <div className="mt-2 divide-y divide-border">
            <Row label="PASS" value={String(qualityCounts.pass)} />
            <Row label="WARN" value={String(qualityCounts.warn)} />
            <Row label="FAIL" value={String(qualityCounts.fail)} />
            <Row label="평가된 규칙 수" value={String(qualityCounts.evaluated)} />
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kubi</p>
        <div className="mt-2 divide-y divide-border">
          <Row label="Kubi 분석 블록" value={`${kubiBlockCount}개`} />
          <Row label="대기 중인 Kubi 노트" value={pendingKubiNoteCount > 0 ? `${pendingKubiNoteCount}건` : "없음"} />
        </div>
      </Card>
    </aside>
  );
}
