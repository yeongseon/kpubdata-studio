import type { BuildQualityResponse, QualityCheckResult, SchemaDriftFinding } from "@/shared/lib/builderApi";

export type ValidationStatus = "PASS" | "WARN" | "FAIL" | "N/A";

/** Builder quality 결과를 점수 없이 PASS/WARN/FAIL/N/A로만 집계한다. */
export function summarizeQuality(
  quality: BuildQualityResponse | null | undefined,
  sourceKey?: string,
): ValidationStatus {
  if (!quality) return "N/A";
  const groups = sourceKey
    ? [quality.quality_results[sourceKey] ?? []]
    : Object.values(quality.quality_results);
  const results = groups.flat();
  if (results.length === 0) return "N/A";
  if (results.some((result) => result.status === "fail")) return "FAIL";
  if (results.some((result) => result.status === "warn")) return "WARN";
  return "PASS";
}

/** 선택 source의 실제 quality 결과만 반환한다. */
export function qualityResultsForSource(
  quality: BuildQualityResponse | null | undefined,
  sourceKey: string,
): QualityCheckResult[] {
  return quality?.quality_results[sourceKey] ?? [];
}

/**
 * Quality Center(#254)용 확장.
 *
 * 위 두 함수(#253)는 dataset detail의 단일 source 스코프 표시에 쓰이므로 그대로 둔다.
 * Quality Center는 여러 source를 가로지르는 집계, availability, evaluated_checks=0(N/A)을
 * 구분해서 보여줘야 해서 별도 함수로 확장한다.
 */

/** run 전체(availability 포함)와 개별 결과 집계를 함께 표현하는 대표 상태.
 * Builder #486 semantics 보존: NOT_EVALUATED(평가된 check 없음)와 UNAVAILABLE(availability=unavailable)을
 * PASS/N/A로 뭉개지 않고 구분한다. */
export type QualityState = "FAIL" | "WARN" | "PASS" | "NOT_EVALUATED" | "UNAVAILABLE";

const PERCENTAGE_QUALITY_RULES = new Set(["max_null_ratio", "max_duplicate_rate"]);
const ROW_COUNT_QUALITY_RULES = new Set(["min_rows"]);

/**
 * Builder canonical rule에 대해서만 단위를 붙인다.
 * 구조화된 threshold와 알 수 없는 rule은 의미를 추측하지 않고 원래 JSON 표현을 보존한다.
 */
export function formatQualityValue(rule: string, value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") {
    if (PERCENTAGE_QUALITY_RULES.has(rule) && value >= 0 && value <= 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    const formatted = value.toLocaleString("ko-KR");
    return ROW_COUNT_QUALITY_RULES.has(rule) ? `${formatted}행` : formatted;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function worstResultStatus(results: QualityCheckResult[]): "fail" | "warn" | "pass" | null {
  if (results.some((result) => result.status === "fail")) return "fail";
  if (results.some((result) => result.status === "warn")) return "warn";
  if (results.length > 0) return "pass";
  return null;
}

/** quality_results를 (선택적으로 source_key로 스코프해) 하나의 배열로 펼친다. */
export function flattenQualityResults(
  quality: BuildQualityResponse | null | undefined,
  sourceKey?: string,
): QualityCheckResult[] {
  if (!quality) return [];
  const groups = sourceKey ? [quality.quality_results[sourceKey] ?? []] : Object.values(quality.quality_results);
  return groups.flat();
}

/** schema_drift를 (선택적으로 source_key로 스코프해) 하나의 배열로 펼친다. */
export function flattenSchemaDrift(
  quality: BuildQualityResponse | null | undefined,
  sourceKey?: string,
): SchemaDriftFinding[] {
  if (!quality) return [];
  const groups = sourceKey ? [quality.schema_drift[sourceKey] ?? []] : Object.values(quality.schema_drift);
  return groups.flat();
}

/**
 * 평가 결과의 대표 severity를 먼저 정한다(FAIL > WARN > PASS > NOT_EVALUATED).
 * availability는 별도 축이며, quality 응답 자체가 없을 때만 UNAVAILABLE을 대표 상태로 사용한다.
 */
export function overallQualityState(
  quality: BuildQualityResponse | null | undefined,
  sourceKey?: string,
): QualityState {
  if (!quality) return "UNAVAILABLE";
  const worst = worstResultStatus(flattenQualityResults(quality, sourceKey));
  if (worst === "fail") return "FAIL";
  if (worst === "warn") return "WARN";
  if (worst === "pass") return "PASS";
  return "NOT_EVALUATED";
}

export interface ChecksPassedSummary {
  pass: number;
  warn: number;
  fail: number;
  /** 분모. 항상 실제 평가된 check 수이며, 0이면 status는 N/A다(가짜 PASS/0%로 표시하지 않음). */
  evaluated: number;
  status: ValidationStatus;
}

/** PASS/evaluated 형태의 요약. evaluated===0이면 status는 N/A. */
export function summarizeChecksPassed(results: QualityCheckResult[]): ChecksPassedSummary {
  const pass = results.filter((result) => result.status === "pass").length;
  const warn = results.filter((result) => result.status === "warn").length;
  const fail = results.filter((result) => result.status === "fail").length;
  const evaluated = results.length;
  const worst = worstResultStatus(results);
  const status: ValidationStatus = worst === "fail" ? "FAIL" : worst === "warn" ? "WARN" : worst === "pass" ? "PASS" : "N/A";
  return { pass, warn, fail, evaluated, status };
}

export interface CategorySummary extends ChecksPassedSummary {
  /** 표시용으로 고른 가장 심각한 개별 결과(FAIL > WARN > 첫 PASS). 평가된 결과가 없으면 null. */
  worst: QualityCheckResult | null;
}

/** category 매처에 해당하는 결과만 골라 요약한다. Builder category는 자유 문자열이라 정확한 값 목록을 가정하지 않는다. */
export function summarizeByCategory(
  results: QualityCheckResult[],
  matches: (category: string) => boolean,
): CategorySummary {
  const filtered = results.filter((result) => matches(result.category));
  const base = summarizeChecksPassed(filtered);
  const worst =
    filtered.find((result) => result.status === "fail") ??
    filtered.find((result) => result.status === "warn") ??
    filtered[0] ??
    null;
  return { ...base, worst };
}

export const isMissingCategory = (category: string): boolean => /missing|null/i.test(category);
export const isDuplicateCategory = (category: string): boolean => /duplicate/i.test(category);
export const isSchemaCategory = (category: string): boolean => /schema/i.test(category);

/** 결과를 최초 등장 순서를 유지한 채 실제 category 값별로 묶는다(고정 목록을 가정하지 않음). */
export function groupByCategory(results: QualityCheckResult[]): { category: string; results: QualityCheckResult[] }[] {
  const order: string[] = [];
  const groups = new Map<string, QualityCheckResult[]>();
  for (const result of results) {
    if (!groups.has(result.category)) {
      groups.set(result.category, []);
      order.push(result.category);
    }
    groups.get(result.category)!.push(result);
  }
  return order.map((category) => ({ category, results: groups.get(category)! }));
}

/** WARN/FAIL 결과만 "Recent quality issues"용으로 남긴다. */
export function warnOrFailResults(results: QualityCheckResult[]): QualityCheckResult[] {
  return results.filter((result) => result.status !== "pass");
}
