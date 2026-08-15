/**
 * Report 본문 요약 문장 생성 (#258 IA 개편 — 표만 나열하는 조회 화면이 아니라 "읽을 수 있는
 * 보고서 본문"이 먼저 보이게 한다).
 *
 * `deterministicSections.ts`가 만드는 상세 표(BuilderEvidenceBlock.markdown)는 그대로 두고,
 * 그 앞에 놓일 문장 요약만 이 파일에서 만든다. 값은 전부 `ReportEvidenceBundle`(Builder에서
 * 그대로 가져온 값)에서만 가져오며 LLM은 관여하지 않는다 — row count/PASS·WARN·FAIL/schema/
 * pipeline status/실제값·기준값 중 어떤 것도 새로 만들지 않는다(#258 §4와 동일 불변식).
 * 확인하지 못한 값은 "확인할 수 없습니다"라고 쓰지 0/PASS로 꾸미지 않는다.
 */
import {
  flattenQualityResults,
  flattenSchemaDrift,
  formatQualityValue,
  isDuplicateCategory,
  isMissingCategory,
  isSchemaCategory,
} from "@/features/quality/model";
import type { QualityCheckResult, SchemaDriftFinding, StageStatus } from "@/shared/lib/builderApi";
import type { ReportEvidenceBundle, ReportSourceSchema } from "./evidence";
import type { BuilderEvidenceSection } from "./types";

const UNAVAILABLE = "확인할 수 없습니다.";

type StageTriple = { bronze: StageStatus; silver: StageStatus; gold: StageStatus };

const STAGE_LABEL: Record<keyof StageTriple, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

const STAGE_ICON: Record<StageStatus, string> = {
  completed: "✓",
  failed: "✕",
  not_run: "미실행",
  unavailable: "확인 불가",
};

export interface QualityCounts {
  pass: number;
  warn: number;
  fail: number;
  evaluated: number;
}

// ---------------------------------------------------------------------------
// 1. 데이터 개요
// ---------------------------------------------------------------------------

export function buildOverviewSummary(evidence: ReportEvidenceBundle): string {
  if (!evidence.dataset.ok) {
    return `\`${evidence.datasetId}\` 정보를 불러오지 못해 개요를 요약할 수 없습니다(${evidence.dataset.reason}).`;
  }
  const dataset = evidence.dataset.value;
  const providers = [...new Set(dataset.sources.map((s) => s.provider))].join(", ") || UNAVAILABLE;
  const runStatus = evidence.run.ok ? evidence.run.value.status : null;

  return [
    `이 보고서는 \`${dataset.title}\`의 Build \`${evidence.runId}\`를 기준으로 작성되었습니다.`,
    `데이터는 ${providers} Provider의 Source로 구성되어 있습니다.`,
    runStatus ? `해당 Run은 ${runStatus} 상태로 종료되었습니다.` : `해당 Run의 종료 상태는 ${UNAVAILABLE}`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// 2. 처리 흐름
// ---------------------------------------------------------------------------

function pipelineFlowLine(sourceKey: string, stage: StageTriple): string {
  // 마크다운 렌더러는 한 줄바꿈을 별도 줄로 만들지 않으므로(GFM hard-break 미지원), 소스명과
  // 흐름을 각자 문단으로 나눠 굵은 글씨 줄이 실제로 별도 줄에 보이게 한다.
  return `**${sourceKey}**\n\nSource → Bronze ${STAGE_ICON[stage.bronze]} → Silver ${STAGE_ICON[stage.silver]} → Gold ${STAGE_ICON[stage.gold]}`;
}

function pipelineSourceSentence(sourceKey: string, stage: StageTriple): string {
  if (stage.gold === "completed") {
    return `\`${sourceKey}\`는 Bronze → Silver → Gold까지 모두 정상 처리되었습니다.`;
  }

  const order: Array<[keyof StageTriple, StageStatus]> = [
    ["bronze", stage.bronze],
    ["silver", stage.silver],
    ["gold", stage.gold],
  ];

  const failedIndex = order.findIndex(([, status]) => status === "failed");
  if (failedIndex !== -1) {
    const [failedStage] = order[failedIndex];
    const next = order[failedIndex + 1];
    if (next && next[1] === "not_run") {
      return `\`${sourceKey}\`는 ${STAGE_LABEL[failedStage]} 단계에서 실패하여 ${STAGE_LABEL[next[0]]} 단계가 실행되지 않았습니다.`;
    }
    return `\`${sourceKey}\`는 ${STAGE_LABEL[failedStage]} 단계에서 실패했습니다.`;
  }

  const stalled = order.find(([, status]) => status !== "completed");
  if (stalled) {
    const [name, status] = stalled;
    return status === "not_run"
      ? `\`${sourceKey}\`는 ${STAGE_LABEL[name]} 단계가 아직 실행되지 않았습니다.`
      : `\`${sourceKey}\`는 ${STAGE_LABEL[name]} 단계 상태를 확인할 수 없습니다.`;
  }

  return `\`${sourceKey}\`의 처리 상태를 확인할 수 없습니다.`;
}

export function buildPipelineSummary(evidence: ReportEvidenceBundle): string {
  const sources: Array<[string, StageTriple]> = evidence.stages.ok
    ? evidence.stages.value.sources.map((s) => [
        s.source_key,
        { bronze: s.bronze.status, silver: s.silver.status, gold: s.gold.status },
      ])
    : evidence.dataset.ok
      ? Object.entries(evidence.dataset.value.stages)
      : [];

  if (sources.length === 0) {
    return `처리 흐름 정보를 ${UNAVAILABLE}`;
  }

  const flows = sources.map(([key, stage]) => pipelineFlowLine(key, stage)).join("\n\n");
  const sentences = sources.map(([key, stage]) => pipelineSourceSentence(key, stage)).join(" ");
  return `${flows}\n\n${sentences}`;
}

// ---------------------------------------------------------------------------
// 3. 품질 진단
// ---------------------------------------------------------------------------

/** 실제 evidence가 있을 때만 값을 채운다(quality 응답 자체가 없거나 availability=unavailable이면 null). */
export function computeQualityCounts(evidence: ReportEvidenceBundle): QualityCounts | null {
  if (!evidence.quality.ok || evidence.quality.value.availability === "unavailable") return null;
  const results = flattenQualityResults(evidence.quality.value);
  return {
    pass: results.filter((r) => r.status === "pass").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
    evaluated: results.length,
  };
}

function qualityResultSentence(result: QualityCheckResult): string {
  const source = `\`${result.source_key}\``;
  const column = result.column ? `\`${result.column}\`` : null;
  const verb = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";

  if (isMissingCategory(result.category) && result.rule === "max_null_ratio") {
    const actual = formatQualityValue(result.rule, result.actual);
    const threshold = formatQualityValue(result.rule, result.threshold);
    const compare = result.status === "pass" ? "이내여서" : "초과해";
    return `${source}의 ${column ?? "대상 컬럼"} 결측률은 ${actual}로 기준값 ${threshold} ${compare} ${verb}했습니다.`;
  }
  if (isSchemaCategory(result.category) && result.rule === "required_column") {
    if (result.status === "pass") return `${source}에서 필수 컬럼 ${column ?? ""}이 확인되어 ${verb}했습니다.`;
    return `${source}에서는 필수 컬럼 ${column ?? ""}이 확인되지 않아 ${verb}했습니다.${result.detail ? ` (${result.detail})` : ""}`;
  }
  if (result.rule === "min_rows") {
    const actual = formatQualityValue(result.rule, result.actual);
    const threshold = formatQualityValue(result.rule, result.threshold);
    return `${source}의 행 수는 ${actual}로 기준값 ${threshold} ${result.status === "pass" ? "이상이어서" : "미달해"} ${verb}했습니다.`;
  }
  if (isDuplicateCategory(result.category)) {
    const actual = formatQualityValue(result.rule, result.actual);
    const threshold = formatQualityValue(result.rule, result.threshold);
    return `${source}의 중복률은 ${actual}로 기준값 ${threshold} ${result.status === "pass" ? "이내여서" : "초과해"} ${verb}했습니다.`;
  }

  // 알 수 없는 rule은 의미를 추측하지 않고 실제값/기준값을 그대로 서술한다.
  const actual = formatQualityValue(result.rule, result.actual);
  const threshold = formatQualityValue(result.rule, result.threshold);
  return `${source}의 \`${result.rule}\`${column ? ` (${column})` : ""} 결과는 ${verb}입니다(실제값 ${actual}, 기준값 ${threshold}).${result.detail ? ` ${result.detail}` : ""}`;
}

function schemaDriftSentence(drift: SchemaDriftFinding[]): string {
  if (drift.length === 0) return "";
  return `Schema drift: ${drift.map((d) => `\`${d.column ?? "N/A"}\` ${d.kind}(${d.detail})`).join(", ")}`;
}

export function buildQualitySummary(evidence: ReportEvidenceBundle): string {
  if (!evidence.quality.ok) {
    return `Quality 결과를 불러오지 못해 요약할 수 없습니다(${evidence.quality.reason}).`;
  }
  const quality = evidence.quality.value;
  if (quality.availability === "unavailable") {
    return `이 run은 Quality 평가가 제공되지 않습니다(availability=unavailable). PASS로 간주하지 않습니다.`;
  }

  const results = flattenQualityResults(quality);
  if (results.length === 0) {
    return `기준 Run에서는 평가된 품질 규칙이 없습니다(evaluated_checks=0).`;
  }

  const pass = results.filter((r) => r.status === "pass").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;
  // WARN이 0건이면 문장에서 생략한다(예시처럼 PASS/FAIL만 자연스럽게 언급) — 그래도 evaluated_checks
  // 분모는 항상 실제 건수를 그대로 쓴다.
  const parts = [`${pass}건은 PASS`, warn > 0 ? `${warn}건은 WARN` : null, `${fail}건은 FAIL`].filter(
    (part): part is string => part !== null,
  );
  const header = `기준 Run에서는 총 ${results.length}건의 품질 검사가 평가되었습니다. 이 중 ${parts.join(", ")}입니다.`;
  const detail = results.map(qualityResultSentence).join(" ");
  const drift = schemaDriftSentence(flattenSchemaDrift(quality));

  return [header, detail, drift].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// 4. 데이터 구조
// ---------------------------------------------------------------------------

function schemaSourceSentence(sourceKey: string, schema: ReportSourceSchema): string {
  const source = `\`${sourceKey}\``;
  if (schema.origin === "silver") {
    const columns = schema.columns.map((c) => `\`${c.name}\``).join(", ");
    return `${source} Silver 결과에서는 ${columns} 컬럼이 확인되었습니다.`;
  }
  if (schema.origin === "gold_names_only") {
    const columns = (schema.columnNamesOnly ?? []).map((name) => `\`${name}\``).join(", ") || UNAVAILABLE;
    return `${source}는 Silver schema를 확인할 수 없어 Gold 결과의 컬럼 이름만 확인됩니다: ${columns}.`;
  }
  return `${source}는 해당 단계의 Schema를 확인할 수 없습니다.${schema.reason ? ` (${schema.reason})` : ""}`;
}

export function buildSchemaSummary(evidence: ReportEvidenceBundle): string {
  const entries = Object.entries(evidence.schemas);
  if (entries.length === 0) return `Schema 정보를 불러올 source가 없어 ${UNAVAILABLE}`;
  return entries.map(([sourceKey, schema]) => schemaSourceSentence(sourceKey, schema)).join("\n\n");
}

// ---------------------------------------------------------------------------
// 5. 데이터 규모
// ---------------------------------------------------------------------------

export function buildDataSummarySummary(evidence: ReportEvidenceBundle): string {
  if (!evidence.dataset.ok) {
    return `Row count 정보를 ${UNAVAILABLE}(${evidence.dataset.reason})`;
  }
  const dataset = evidence.dataset.value;
  const rows = Object.entries(dataset.row_counts);
  const totalLine = `확인 가능한 Source의 총 행 수는 ${dataset.total_row_count.toLocaleString("ko-KR")}건입니다.`;
  if (rows.length === 0) return `${totalLine} source별 세부 정보는 ${UNAVAILABLE}`;
  const bySource = rows.map(([key, count]) => `\`${key}\` ${count.toLocaleString("ko-KR")}건`).join(", ");
  return `${totalLine} ${bySource}으로 구성됩니다.`;
}

// ---------------------------------------------------------------------------
// 6. Output
// ---------------------------------------------------------------------------

export function buildOutputSummary(evidence: ReportEvidenceBundle): string {
  if (!evidence.output.ok) {
    return `**Output 확인 불가**\n\n${evidence.output.reason}`;
  }
  const files = evidence.output.value.files;
  if (files.length === 0) return `이 run에 대해 보고된 output 파일이 없습니다.`;
  return `이 run에는 총 ${files.length}개의 output 파일이 있습니다: ${files.map((f) => `\`${f}\``).join(", ")}.`;
}

// ---------------------------------------------------------------------------

export function buildSectionSummaries(evidence: ReportEvidenceBundle): Record<BuilderEvidenceSection, string> {
  return {
    overview: buildOverviewSummary(evidence),
    pipeline: buildPipelineSummary(evidence),
    quality: buildQualitySummary(evidence),
    schema: buildSchemaSummary(evidence),
    data_summary: buildDataSummarySummary(evidence),
    output: buildOutputSummary(evidence),
  };
}
