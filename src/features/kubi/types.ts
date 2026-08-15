/**
 * Kubi 공용 타입 (#256).
 *
 * Issue #256이 고정한 `KubiContext` 형태와, 그 위에서 동작하는 evidence/구조화 응답/액션/
 * 대화 turn 타입을 한곳에 모은다. UI·evidence·prompt·cross-check·action 모듈이 모두 이 파일의
 * 타입만 공유하므로, 형태를 바꿀 때는 여기 하나만 고치면 된다.
 */
import type { QueryResponse } from "@/shared/lib/builderApi";
import type { KubiAction } from "./schema";

/** Builder medallion stage 중 Kubi가 문맥으로 다루는 값. */
export type KubiStage = "bronze" | "silver" | "gold";

/**
 * Issue #256이 고정한 Kubi context 계약.
 *
 * 필드를 추가/삭제하면 route resolver·stale guard·evidence·prompt가 전부 영향을 받으므로
 * 이 형태는 issue 설계를 벗어나지 않는 선에서만 확장한다.
 */
export interface KubiContext {
  page: string;
  datasetId?: string;
  runId?: string;
  stage?: KubiStage;
  qualityResultIds?: string[];
  provider?: string;
}

/** 특정 quality 결과를 안정적으로 가리키기 위한 합성 ID. Builder 응답에는 id가 없다. */
export function qualityResultRefId(result: {
  source_key: string;
  category: string;
  rule: string;
  column: string | null;
}): string {
  return `${result.source_key}::${result.category}::${result.rule}::${result.column ?? "_"}`;
}

/** evidence 조회 중 실패한 개별 evidence 종류. */
export type KubiEvidenceSource = "dataset" | "runs" | "stage" | "quality" | "catalog" | "spec";

/** Evidence에 포함하는 quality 결과 요약(원본 QualityCheckResult에 안정적 id만 덧붙임). */
export interface KubiQualityResultEvidence {
  id: string;
  sourceKey: string;
  category: string;
  rule: string;
  column: string | null;
  status: "pass" | "warn" | "fail";
  actual: unknown;
  threshold: unknown;
  detail: string | null;
}

/** LLM에 전달하는 safe evidence 번들. secret/원본 credential은 포함하지 않는다. */
export interface KubiEvidence {
  fetchedAt: string;
  context: KubiContext;
  dataset?: {
    datasetId: string;
    title: string;
    providers: string[];
    /** provider+source dataset명 쌍. 관련 데이터셋 후보 계산 시 "자기 자신"을 제외하는 데 쓴다. */
    sources: { provider: string; dataset: string }[];
    latestRunId: string;
    status: string;
    updatedAt: string | null;
    totalRowCount: number;
  };
  recentRuns?: { runId: string; status: string; startedAt: string | null; finishedAt: string | null }[];
  stage?: {
    stage: KubiStage;
    sourceKey: string;
    status: string;
    available: boolean;
    rowCount: number | null;
  };
  quality?: {
    availability: "available" | "partial" | "unavailable";
    evaluatedChecks: number;
    results: KubiQualityResultEvidence[];
    schemaDrift: { kind: string; column: string | null; detail: string }[];
  };
  catalog?: {
    providers: string[];
    datasetsByProvider: Record<string, string[]>;
  };
  buildSpecSummary?: {
    title: string;
    description: string;
    sources: { provider: string; dataset: string; alias?: string; paramKeys: string[] }[];
    exportFormats: string[];
    metadataKeys: string[];
  };
  deepLinks: {
    datasetDetail?: string;
    qualityCenter?: string;
    buildDetail?: string;
  };
  /** 일부 evidence 조회가 실패했는지 여부. true면 답변이 전체를 확인한 것처럼 말하면 안 된다. */
  partial: boolean;
  /** 조회에 실패한 evidence 종류 목록(사용자에게 그대로 노출). */
  unavailable: KubiEvidenceSource[];
}

/** evidence 안의 단일 참조 대상(존재 검증에 사용하는 알려진 id 집합). */
export interface KubiKnownRefs {
  datasetIds: Set<string>;
  runIds: Set<string>;
  providers: Set<string>;
  qualityResultIds: Set<string>;
  schemaDriftIds: Set<string>;
}

/** LLM 구조화 응답이 근거로 인용한 evidence 조각. */
export interface KubiEvidenceRef {
  kind: "dataset" | "run" | "stage" | "quality" | "schema_drift" | "catalog";
  id: string;
  label: string;
}

/** LLM이 제안한 Generated SQL(자동 실행되지 않음 — 사용자가 명시적으로 실행해야 함). */
export interface KubiGeneratedSql {
  sql: string;
  stage: "silver" | "gold";
  source?: string;
}

/** Zod 통과 + evidence/catalog 대조까지 마친 구조화 응답. */
export interface KubiStructuredResponse {
  answer: string;
  evidenceRefs: KubiEvidenceRef[];
  generatedSql: KubiGeneratedSql | null;
  suggestedActions: KubiAction[];
}

/** 하나의 질문-답변 turn이 실패할 수 있는 방식. 사용자에게 안전한 상태로 그대로 보여준다. */
export type KubiErrorState =
  | { kind: "no_key" }
  | { kind: "bad_base_url"; message: string }
  | { kind: "llm_error"; message: string }
  | { kind: "cancelled" }
  | { kind: "malformed_output"; message: string }
  | { kind: "hallucinated_refs"; message: string; rejectedRefs: string[]; rejectedActions: string[] }
  | { kind: "stale_context" };

/** Generated SQL 실행(Builder `/query`) 결과 상태. */
export type KubiQueryState =
  | { status: "idle" }
  | { status: "blocked"; reason: string }
  | { status: "running" }
  | { status: "success"; result: QueryResponse }
  | {
      status: "error";
      code:
        | "unsafe_query"
        | "forbidden"
        | "artifact_unavailable"
        | "invalid_context"
        | "invalid_request"
        | "query_busy"
        | "query_timeout"
        | "query_execution_failed"
        | "network"
        | "mock_mode"
        | "unknown";
      message: string;
    };

/** 액션 승인/실행 상태. */
export type KubiActionRunState =
  | { status: "pending_approval" }
  | { status: "approved" }
  | { status: "applying" }
  | { status: "applied"; message: string }
  | { status: "rejected"; reason: string }
  | { status: "error"; message: string };

/** 하나의 질문에서 시작된 전체 turn. context는 요청 시작 시점 값을 그대로 고정한다(stale guard). */
export interface KubiTurn {
  id: string;
  question: string;
  /** 이 turn을 시작할 때의 context — 이후 라우트가 바뀌어도 값이 변하지 않는다. */
  context: KubiContext;
  createdAt: string;
  status: "loading" | "ok" | "error";
  evidence?: KubiEvidence;
  response?: KubiStructuredResponse;
  error?: KubiErrorState;
  rawOutput?: string;
  query: KubiQueryState;
  actionStates: Record<number, KubiActionRunState>;
  /**
   * true면 이 turn은 실제 LLM/Builder `/query`를 호출하지 않은 mock 데모다(`features/kubi/demo.ts`).
   * mock Builder 모드에서 BYOK 없이 evidence→응답→Generated SQL 흐름을 보여주기 위한 것으로,
   * "실제 결과"와 혼동되지 않도록 UI가 이 값을 보고 항상 데모 표시를 해야 한다.
   */
  isDemo?: boolean;
}

/**
 * evidence의 quality 결과를 context bar/데모 응답에 쓸 짧은 요약으로 바꾼다.
 * 평가된 rule이 없거나 조회하지 못했으면 "—"(N/A) — PASS/0%로 꾸며내지 않는다.
 */
export function summarizeKubiQuality(quality: KubiEvidence["quality"]): string {
  if (!quality || quality.availability === "unavailable") return "—";
  const failCount = quality.results.filter((result) => result.status === "fail").length;
  if (failCount > 0) return `${failCount} FAIL`;
  const warnCount = quality.results.filter((result) => result.status === "warn").length;
  if (warnCount > 0) return `${warnCount} WARN`;
  if (quality.evaluatedChecks > 0) return "PASS";
  return "—";
}
