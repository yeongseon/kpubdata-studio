/**
 * Kubi 추천 질문 — "사용자가 다음으로 물어볼 만한 질문"을 현재 context와 최근 대화에서
 * deterministic하게 고른다(#S-kubi-suggest). LLM을 추가로 호출하지 않는다.
 *
 * `KubiContent`(우측 추천 질문 패널 + 첫 질문 전 onboarding 칩)와 Home Kubi hero가 이
 * helper를 공유한다 — 고정 문자열 배열을 그대로 UI에 노출하지 않는다.
 *
 * 원칙:
 * - 현재 context(dataset/run/quality/stage)로 실제로 답할 수 있는 질문만 노출한다.
 * - Dataset/Run/Quality가 없으면 Quality·Build 실패·SQL 질문을 강제로 넣지 않는다.
 * - 최근 turn이 있으면 그 turn의 **구조화된 단서**(response.generatedSql /
 *   evidence.quality / evidence.catalog / evidence.dataset / suggestedActions)로
 *   follow-up을 고른다. assistant prose를 NLP parsing하거나 임의 문자열 매칭하지 않는다.
 * - 구조적 단서가 부족하면 최근 질문을 구체화하는 generic follow-up으로 fallback한다.
 * - Suggested Action(실행/이동)과 역할을 섞지 않는다 — 여기서는 전부 "다음 질문"만.
 */
import type { KubiContext, KubiTurn } from "./types";

/**
 * Dataset/Run/Quality context가 하나도 없을 때(Home hero, 빈 /kubi) 보여줄 시작 질문.
 * Quality/Build 실패/SQL 질문을 포함하지 않는다.
 */
export const START_QUESTIONS = [
  "어떤 공공데이터부터 찾아볼 수 있어?",
  "원하는 데이터셋을 찾는 방법을 알려줘.",
  "Public API 데이터를 추가하려면 어떻게 해야 해?",
  "KPubData의 전체 작업 흐름을 설명해줘.",
];

/**
 * @deprecated UI에 직접 노출하지 않는다 — `getSuggestedQuestions`를 쓴다. 기존 import
 * 호환을 위해 남겨 둔 값으로, 내용은 "context가 있을 때"의 요약/품질/실패/SQL 질문이다.
 */
export const SUGGESTED_QUESTIONS = [
  "현재 화면 문맥을 요약해줘.",
  "지금 확인된 Quality 이슈의 원인과 우선순위를 알려줘.",
  "이 Build가 실패했다면 원인을 분석해줘.",
  "이 데이터로 어떤 걸 SQL로 확인할 수 있을지 제안해줘.",
];

export interface SuggestedQuestionsInput {
  /** 지금 이 순간의 route context. */
  context: KubiContext;
  /** 현재 세션의 대화 turn 목록(가장 오래된 것부터). */
  turns: KubiTurn[];
  /**
   * turn이 현재 context와 어긋나면(다른 화면 기준) follow-up 근거로 쓰지 않는다.
   * 생략하면 모든 turn을 유효한 것으로 본다.
   */
  isStale?: (turn: KubiTurn) => boolean;
  /** 최대 노출 개수(기본 4). */
  limit?: number;
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

/** context만으로 고르는 초기 추천(대화 turn이 아직 없을 때). */
function initialQuestions(context: KubiContext): string[] {
  // D. Quality context가 "실제로" 있을 때만 Quality-specific.
  if (context.page === "quality" && (context.runId || context.datasetId)) {
    return [
      "현재 Quality 이슈의 원인을 설명해줘.",
      "가장 먼저 확인해야 할 문제는 뭐야?",
      "WARN/FAIL 항목을 어떻게 개선할 수 있어?",
    ];
  }
  // Silver/Gold stage — 컬럼/SQL.
  if (context.stage === "silver" || context.stage === "gold") {
    return [
      "사용할 수 있는 컬럼을 알려줘.",
      "이 데이터를 집계하는 SQL을 만들어줘.",
      "이 단계 데이터로 어떤 분석을 할 수 있어?",
    ];
  }
  // C. Run context가 있을 때만 Run/실패 질문.
  if (context.runId) {
    return [
      "이 Run 결과를 요약해줘.",
      "경고되거나 실패한 단계가 있어?",
      "이 Run의 Quality 결과를 설명해줘.",
      "다음에 어떤 작업을 해야 해?",
    ];
  }
  // B. Dataset context가 있을 때만 Dataset-specific.
  if (context.datasetId) {
    return [
      "이 데이터셋의 구조를 요약해줘.",
      "이 데이터에서 확인할 품질 문제는 뭐야?",
      "이 데이터로 어떤 분석을 할 수 있어?",
      "Silver/Gold 단계에서는 어떻게 활용할 수 있어?",
    ];
  }
  // A. 아무 context도 없음.
  return START_QUESTIONS;
}

/** 가장 최근의, 현재 context와 어긋나지 않은 "답변 완료" turn. */
function lastAnsweredTurn(
  turns: KubiTurn[],
  isStale?: (turn: KubiTurn) => boolean,
): KubiTurn | undefined {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.status !== "ok" || !turn.response) continue;
    if (isStale && isStale(turn)) continue;
    return turn;
  }
  return undefined;
}

/** 최근 turn의 구조화된 단서로 고르는 follow-up 질문. */
function followUpQuestions(turn: KubiTurn, context: KubiContext): string[] {
  const response = turn.response;
  const evidence = turn.evidence;
  const out: string[] = [];

  if (response?.generatedSql) {
    out.push(
      "이 SQL 결과를 어떻게 해석하면 돼?",
      "조건을 바꿔서 다시 집계해줘.",
      "결과에서 눈에 띄는 값이 있으면 짚어줘.",
    );
  }

  const quality = evidence?.quality;
  const hasQualityIssue =
    !!quality &&
    quality.availability !== "unavailable" &&
    quality.results.some((result) => result.status === "warn" || result.status === "fail");
  if (hasQualityIssue) {
    out.push(
      "가장 먼저 고쳐야 할 품질 문제는 뭐야?",
      "이 품질 문제가 다음 단계에 어떤 영향을 줘?",
    );
  }

  // 데이터 탐색/추천 성격 — catalog 근거가 있거나 아직 dataset/run을 안 정한 상태.
  if (evidence?.catalog || (!context.datasetId && !context.runId)) {
    out.push(
      "추천한 데이터셋 중 어떤 걸 먼저 보는 게 좋아?",
      "이 데이터를 Add Data로 가져오는 방법을 알려줘.",
      "지역별로 비교하려면 어떤 데이터가 적합해?",
      "분석을 시작하려면 다음 단계가 뭐야?",
    );
  }

  if (evidence?.dataset) {
    out.push(
      "이 데이터셋으로 어떤 분석을 할 수 있어?",
      "다음으로 어떤 단계를 진행하면 돼?",
    );
  }

  if (evidence?.stage || (evidence?.recentRuns?.length ?? 0) > 0 || context.runId) {
    out.push(
      "이 결과에서 다음으로 확인할 건 뭐야?",
      "경고되거나 실패한 단계가 있어?",
    );
  }

  // 구조적 단서가 부족하면 최근 질문을 구체화하는 generic follow-up.
  if (out.length === 0) {
    out.push(
      "방금 답변을 좀 더 자세히 설명해줘.",
      "이걸 바탕으로 다음 단계를 추천해줘.",
      "관련해서 더 확인할 데이터가 있어?",
    );
  }

  return out;
}

/**
 * 현재 context와 최근 대화에서 다음 질문 후보를 고른다.
 *
 * - 최근에 답변 완료된(그리고 stale하지 않은) turn이 있으면 그 대화 맥락을 우선한다.
 * - 없으면 context(dataset/run/quality/stage)별 초기 추천을 준다.
 * - 결과는 중복 제거 후 `limit`(기본 4)개로 자른다.
 */
export function getSuggestedQuestions(input: SuggestedQuestionsInput): string[] {
  const { context, turns, isStale, limit = 4 } = input;

  const recent = lastAnsweredTurn(turns, isStale);
  const questions = recent
    ? followUpQuestions(recent, context)
    : initialQuestions(context);

  return dedupe(questions).slice(0, limit);
}
