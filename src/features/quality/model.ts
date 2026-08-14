import type { BuildQualityResponse, QualityCheckResult } from "@/shared/lib/builderApi";

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
