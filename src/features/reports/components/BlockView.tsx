/**
 * 단일 Report 블록을 provenance에 맞게 읽기 전용으로 렌더링한다 (#258 §10, IA 개편).
 *
 * BUILDER_EVIDENCE 블록은 항상 read-only다(사용자가 실제 값을 몰래 바꿔치기할 수 없게 —
 * #258 §3, §10). 수정하고 싶으면 evidence를 새로고침해 재생성하거나, 별도 USER_CONTENT
 * 블록으로 자기 설명을 덧붙인다.
 *
 * IA 개편(표만 나열하는 조회 화면 금지): `summary`(deterministic 문장 요약)를 먼저 보여주고,
 * 기존 `markdown`(표/상세 근거)는 `<details>`로 접어 필요할 때만 펼친다. 표 자체는 지우지
 * 않는다 — 위치만 옮긴다.
 */
import { useState } from "react";
import { Card } from "@/shared/ui";
import { renderMarkdownToReact } from "../markdown";
import type { BuilderEvidenceBlock, BuilderEvidenceSection, ReportBlock, ReportEvidenceRef } from "../types";
import { ProvenanceBadge } from "./ProvenanceBadge";

const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  ok: "",
  partial: "일부만 확인됨",
  unavailable: "확인할 수 없음",
};

const SECTION_LABEL: Record<BuilderEvidenceSection, string> = {
  overview: "1. 데이터 개요",
  pipeline: "2. 처리 흐름",
  quality: "3. 품질 진단",
  schema: "4. 데이터 구조",
  data_summary: "5. 데이터 규모",
  output: "6. Output",
};

/**
 * NewBuildPage(#97)의 `<details className="group">` disclosure 패턴을 재사용하되, 열림 상태를
 * React state로 직접 제어한다 — 브라우저 기본 toggle 동작에만 기대면 테스트 환경/스크린리더
 * 조합에 따라 동작이 갈릴 수 있어, `summary` 클릭에서 기본 동작을 막고 state로만 연다/닫는다.
 */
function BuilderEvidenceBlockCard({ block }: { block: BuilderEvidenceBlock }) {
  const [detailOpen, setDetailOpen] = useState(false);

  // Output이 확인 불가할 때는 summary가 이미 사유를 전부 담고 있어, 표를 펼쳐도 같은 문장을
  // 반복할 뿐이다 — 이때만 상세 근거 disclosure를 만들지 않는다(#258 IA 개편 §4).
  const hasDetail = !(block.section === "output" && block.evidenceStatus === "unavailable");
  // summary가 이미 evidenceStatus 사유를 문장으로 담고 있는 섹션이 많아, output에서는 배지성
  // 경고 문구를 중복 표시하지 않는다.
  const showStatusBanner = block.evidenceStatus !== "ok" && block.section !== "output";

  return (
    <Card className="space-y-3" data-testid={`block-${block.section}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{SECTION_LABEL[block.section]}</h3>
        <ProvenanceBadge provenance="BUILDER_EVIDENCE" />
      </div>
      {showStatusBanner ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {EVIDENCE_STATUS_LABEL[block.evidenceStatus]}
          {block.unavailableReason ? `: ${block.unavailableReason}` : ""}
        </p>
      ) : null}
      <div className="space-y-2 text-sm leading-relaxed text-foreground">
        {block.summary ? renderMarkdownToReact(block.summary) : renderMarkdownToReact(block.markdown)}
      </div>
      {block.summary && hasDetail ? (
        <details className="group border-t border-border pt-2" open={detailOpen}>
          <summary
            className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.preventDefault();
              setDetailOpen((prev) => !prev);
            }}
          >
            상세 근거 보기
            <span className="text-sm transition group-open:rotate-180" aria-hidden="true">
              ⌄
            </span>
          </summary>
          {detailOpen ? (
            <div className="mt-3 space-y-2 text-sm text-foreground">{renderMarkdownToReact(block.markdown)}</div>
          ) : null}
        </details>
      ) : null}
    </Card>
  );
}

export function BlockView({
  block,
  reportEvidenceRefs,
  onEditUserContent,
  onDeleteUserContent,
  onRemoveKubiBlock,
}: {
  block: ReportBlock;
  /** KUBI_INTERPRETATION 블록이 현재 Report와 같은 dataset/run 기준일 때만 넘긴다(#258 §7). */
  reportEvidenceRefs?: ReportEvidenceRef[];
  onEditUserContent?: (id: string) => void;
  onDeleteUserContent?: (id: string) => void;
  onRemoveKubiBlock?: (id: string) => void;
}) {
  if (block.provenance === "BUILDER_EVIDENCE") {
    return <BuilderEvidenceBlockCard block={block} />;
  }

  if (block.provenance === "KUBI_INTERPRETATION") {
    return (
      <Card className="space-y-2 border-indigo-200 dark:border-indigo-900/60" data-testid="block-kubi">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Kubi 분석 · AI 작성</h3>
          <div className="flex items-center gap-2">
            <ProvenanceBadge provenance="KUBI_INTERPRETATION" />
            {onRemoveKubiBlock ? (
              <button
                type="button"
                onClick={() => onRemoveKubiBlock(block.id)}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                제거
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          기준 Dataset: {block.sourceContext.datasetId ?? "N/A"} · 기준 Run: {block.sourceContext.runId ?? "N/A"}
          {block.sourceContext.stage ? ` · Stage: ${block.sourceContext.stage}` : ""}
        </p>
        {!block.isSameContext ? (
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
            참고 분석 · 현재 Report의 기준 dataset/run과 다릅니다(자동으로 합치지 않음).
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          생성 시각 {new Date(block.generatedAt).toLocaleString("ko-KR")}
          {block.provider ? ` · provider ${block.provider}` : ""}
          {block.model ? ` · model ${block.model}` : ""}
        </p>
        <div className="space-y-2 text-sm text-foreground">{renderMarkdownToReact(block.note)}</div>
        <p className="text-xs italic text-muted-foreground">판단 근거: {block.reason}</p>
        {block.isSameContext && reportEvidenceRefs && reportEvidenceRefs.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            연결된 Evidence: {reportEvidenceRefs.map((ref) => ref.label).join(", ")}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-2 border-amber-200 dark:border-amber-900/60" data-testid="block-user">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{block.heading}</h3>
        <div className="flex items-center gap-2">
          <ProvenanceBadge provenance="USER_CONTENT" />
          {onEditUserContent ? (
            <button
              type="button"
              onClick={() => onEditUserContent(block.id)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              편집
            </button>
          ) : null}
          {onDeleteUserContent ? (
            <button
              type="button"
              onClick={() => onDeleteUserContent(block.id)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 text-sm text-foreground">{renderMarkdownToReact(block.markdown)}</div>
    </Card>
  );
}
