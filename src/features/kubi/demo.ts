/**
 * Kubi mock/dev 데모 (#256 review — "지금 프로토타입이랑 좀 다르게 만들어 진 것 같음" 후속).
 *
 * BYOK API key가 없어도 mock Builder 모드에서 Kubi의 evidence → 구조화 응답 → Generated SQL →
 * Result Preview 흐름을 볼 수 있게 하는 결정적(deterministic) 데모 경로다. 실제 LLM을 호출하지
 * 않고, 실제 Builder `/query`도 호출하지 않는다 — 오직 `features/datasets/api`가 이미 제공하는
 * mock evidence(#256 evidence.ts가 그대로 재사용)만 근거로 고정된 텍스트를 조립한다.
 *
 * **"실제 결과"처럼 속이지 않는다**: 이 모듈이 만든 모든 turn은 `KubiTurn.isDemo = true`로
 * 표시되고, 답변 첫 줄에도 데모임을 명시한다. UI는 이 값을 보고 항상 데모 배지를 그려야 한다.
 *
 * real mode(`VITE_USE_REAL_BUILDER=true`)에서는 이 모듈이 전혀 쓰이지 않는다 — 그대로
 * BYOK → 실제 LLM(`features/assistant/provider`) → Builder `/query`(`features/kubi/query.ts`)
 * 경로를 탄다.
 */
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { QueryResponse } from "@/shared/lib/builderApi";
import type { KubiAction } from "./schema";
import { summarizeKubiQuality } from "./types";
import type { KubiEvidence, KubiQueryState, KubiStructuredResponse } from "./types";

/** 데모를 제공할 수 있는지: mock Builder 모드(기본값)에서만 — real mode는 항상 BYOK를 요구한다. */
export function isKubiDemoAvailable(): boolean {
  return !isRealBuilderEnabled();
}

const DEMO_DISCLAIMER = "[DEMO] mock 데이터 기반 예시 응답입니다 — 실제 분석 결과가 아닙니다.";

/**
 * 실제로 조회된(mock) evidence만 근거로 결정적 구조화 응답을 만든다. LLM을 호출하지 않으므로
 * evidence에 없는 id를 인용할 수 없다 — 그래서 hallucination cross-check 없이도 안전하다.
 *
 * @param evidence - `loadKubiEvidence`가 반환한 evidence(데모에서도 실제 mock 데이터 경로를 그대로 탄다).
 */
export function buildKubiDemoResponse(evidence: KubiEvidence): KubiStructuredResponse {
  const lines: string[] = [DEMO_DISCLAIMER];
  const evidenceRefs: KubiStructuredResponse["evidenceRefs"] = [];
  const suggestedActions: KubiAction[] = [];

  if (evidence.dataset) {
    lines.push(
      `데이터셋 "${evidence.dataset.title}"(${evidence.dataset.datasetId})의 최신 상태는 "${evidence.dataset.status}"입니다.`,
    );
    evidenceRefs.push({ kind: "dataset", id: evidence.dataset.datasetId, label: evidence.dataset.title });

    const runId = evidence.context.runId ?? evidence.dataset.latestRunId;
    suggestedActions.push({
      type: "OPEN_QUALITY",
      datasetId: evidence.dataset.datasetId,
      runId,
      reason: "[DEMO] Quality Center에서 이 run의 실제 rule 결과를 확인할 수 있습니다.",
    });
    suggestedActions.push({
      type: "ADD_REPORT_BLOCK",
      note: `[DEMO] "${evidence.dataset.title}" 데모 분석 — mock 데이터 기반이며 실제 분석이 아닙니다.`,
      reason: "[DEMO] 이 데모 응답을 참고 노트로 Report에 남길 수 있습니다.",
    });
  } else {
    lines.push("현재 선택된 Dataset이 없어 일반 안내만 제공합니다. Dataset을 선택하면 더 구체적인 데모를 볼 수 있습니다.");
  }

  if (evidence.quality) {
    const summary = summarizeKubiQuality(evidence.quality);
    lines.push(summary === "—" ? "평가된 Quality 결과가 없습니다." : `Quality 결과 요약: ${summary}.`);
    const firstResult = evidence.quality.results[0];
    if (firstResult) {
      evidenceRefs.push({ kind: "quality", id: firstResult.id, label: `${firstResult.category}/${firstResult.rule}` });
    }
  }

  let generatedSql: KubiStructuredResponse["generatedSql"] = null;
  if (evidence.stage && (evidence.context.stage === "silver" || evidence.context.stage === "gold")) {
    generatedSql = {
      // Builder #504 contract: SQL은 logical relation "dataset"만 조회한다 — 실제 source_key는
      // FROM 테이블명이 아니라 아래 source 필드로 별도 전달한다(query.ts가 /query 요청에 얹는다).
      sql: `SELECT region, COUNT(*) AS count FROM dataset GROUP BY region`,
      stage: evidence.context.stage,
      source: evidence.stage.sourceKey,
    };
    evidenceRefs.push({
      kind: "stage",
      id: `${evidence.stage.sourceKey}:${evidence.stage.stage}`,
      label: `${evidence.stage.sourceKey} · ${evidence.stage.stage}`,
    });
    lines.push("Generated SQL은 데모용 미리보기 조회입니다 — 실행하면 mock 결과가 표시됩니다(실제 Builder 호출 없음).");
  } else if (evidence.dataset) {
    lines.push("위 Stage 선택에서 Silver 또는 Gold를 고르면 Generated SQL·Result Preview 데모도 함께 볼 수 있습니다.");
  }

  return { answer: lines.join("\n"), evidenceRefs, generatedSql, suggestedActions };
}

/** 데모 Generated SQL(`SELECT region, COUNT(*) ... GROUP BY region`) "실행"을 눌렀을 때 보여줄 고정 mock 결과. */
const DEMO_QUERY_RESULT: QueryResponse = {
  columns: ["region", "count"],
  rows: [
    { region: "서울", count: 123 },
    { region: "부산", count: 98 },
    { region: "인천", count: 41 },
  ],
  truncated: false,
  execution_ms: 8,
};

/**
 * 데모 turn의 Generated SQL "실행" — Builder `/query`를 호출하지 않고 고정된 mock 결과를
 * 즉시 반환한다(`features/kubi/query.ts`의 `runKubiQuery`와 달리 real mode에서는 쓰이지 않음).
 */
export async function runKubiDemoQuery(): Promise<KubiQueryState> {
  return { status: "success", result: DEMO_QUERY_RESULT };
}
