/**
 * Builds/Runs master-detail(#255)용 순수 모델 헬퍼.
 *
 * Builder가 반환한 값만 사용하고, Studio가 상태를 추측·재계산하지 않는다(#246 원칙).
 * Run 전체 상태(BuildRunStatus)와 medallion stage 상태(StageStatus, #488)는 서로 다른
 * 축이므로 여기서도 절대 하나로 뭉개지 않는다.
 */
import { ApiError } from "@/shared/lib/builderApi";
import type { BuildListItem, BuildRunStatus } from "@/shared/lib/types";
import type { BuildQualityResponse, QualityCheckResult, RunStageEntry } from "@/shared/lib/builderApi";

/**
 * 상단 KPI 카드용 집계.
 *
 * Builder `GET /builds`는 전체 건수(total)를 제공하지 않고 `limit`으로 자른 목록만
 * 돌려준다(BuildsResponse에 count 필드 없음, contract SSOT 확인 완료). 그래서 이 집계는
 * "현재 조회된 scope" 안에서만 계산되는 값이며 전체 히스토리의 진짜 합계가 아니다 —
 * 호출부는 반드시 `scopeLimit`/`scopeCount`를 함께 노출해 그 사실을 드러내야 한다.
 *
 * 또한 `GET /builds`는 완료된(ok/failed) 이력만 반환하고 진행 중인(queued/running) job은
 * 포함하지 않는다(별도 in-memory job registry, `GET /builds/{run_id}`). 그래서 실연동
 * 모드에서는 이 목록만으로 "지금 실행 중인 Run 수"를 정확히 셀 수 없다 — `runningAvailable`이
 * false면 Running 값을 0으로 가장하지 말고 UI에서 N/A로 표시해야 한다.
 */
export interface BuildKpi {
  scopeCount: number;
  scopeLimit: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  running: number;
  /** false면 이 scope에서 running 값을 신뢰할 수 없다(계약상 완료 이력만 옴). */
  runningAvailable: boolean;
}

export function computeBuildKpi(
  items: BuildListItem[],
  scopeLimit: number,
  runningAvailable: boolean,
): BuildKpi {
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  let running = 0;
  for (const item of items) {
    if (item.status === "succeeded") succeeded += 1;
    else if (item.status === "failed") failed += 1;
    else if (item.status === "cancelled") cancelled += 1;
    else if (item.status === "queued" || item.status === "running") running += 1;
  }
  return { scopeCount: items.length, scopeLimit, succeeded, failed, cancelled, running, runningAvailable };
}

export type RunStatusFilter = "all" | BuildRunStatus;

export function matchesStatusFilter(item: BuildListItem, filter: RunStatusFilter): boolean {
  return filter === "all" || item.status === filter;
}

export function matchesSearch(item: BuildListItem, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = `${item.title ?? ""} ${item.id}`.toLowerCase();
  return haystack.includes(trimmed);
}

/** 여러 source가 있는 run에서 하나라도 실패했으면 실패 source 목록을 뽑는다(#255 §7). */
export function failedSources(sources: RunStageEntry[]): string[] {
  return sources
    .filter((source) => source.bronze.status === "failed" || source.silver.status === "failed" || source.gold.status === "failed")
    .map((source) => source.source_key);
}

/** source의 medallion stage 중 마지막으로 completed된 stage. 하나도 없으면 null(추측하지 않음). */
export function lastCompletedStage(source: RunStageEntry): "gold" | "silver" | "bronze" | null {
  if (source.gold.status === "completed") return "gold";
  if (source.silver.status === "completed") return "silver";
  if (source.bronze.status === "completed") return "bronze";
  return null;
}

/** source의 medallion stage 중 실제로 failed로 기록된 첫 stage. not_run은 실패가 아니다. */
export function firstFailedStage(source: RunStageEntry): "bronze" | "silver" | "gold" | null {
  if (source.bronze.status === "failed") return "bronze";
  if (source.silver.status === "failed") return "silver";
  if (source.gold.status === "failed") return "gold";
  return null;
}

/**
 * 여러 source가 섞여 있을 때 run 전체를 하나의 label로 뭉개지 않고, 정확히
 * "모두 성공" / "부분 실패(partial)" / "모두 실패" / "정보 없음" 만 구분한다.
 * Builder run status enum에는 "partial"이 없으므로(BuildJob: queued/running/cancelling/
 * succeeded/failed/cancelled) 이 값은 Run status를 대체하지 않는, source 조합에 대한
 * 별도의 UI 전용 요약이다.
 */
export type MultiSourceOutcome = "all_succeeded" | "partial" | "all_failed" | "unavailable";

export function summarizeMultiSourceOutcome(sources: RunStageEntry[]): MultiSourceOutcome {
  if (sources.length === 0) return "unavailable";
  const failedCount = failedSources(sources).length;
  if (failedCount === 0) return "all_succeeded";
  if (failedCount === sources.length) return "all_failed";
  return "partial";
}

export interface FailureEvidenceItem {
  sourceKey: string;
  failedStage: "bronze" | "silver" | "gold" | null;
  lastCompletedStage: "gold" | "silver" | "bronze" | null;
}

export function collectFailureEvidence(sources: RunStageEntry[]): FailureEvidenceItem[] {
  return sources
    .filter((source) => firstFailedStage(source) !== null)
    .map((source) => ({
      sourceKey: source.source_key,
      failedStage: firstFailedStage(source),
      lastCompletedStage: lastCompletedStage(source),
    }));
}

/**
 * selected Run 상세를 구성하는 API(stage/quality/spec/live status)가 던진 에러를
 * Studio가 그릴 수 있는 최소 종류로만 구분한다(#255 P0 permission state).
 *
 * "권한 없음"을 Studio가 추측하지 않는다 — Builder가 HTTP 403으로 명시했을 때만
 * permission_denied로 분류하고, 그 외 401/네트워크/5xx는 모두 일반 error로 남긴다.
 * 새 auth model을 만들지 않고 기존 ApiError.status만 읽는다.
 */
export type RunApiErrorKind = "not_found" | "permission_denied" | "error";

export function classifyRunApiError(cause: unknown): RunApiErrorKind {
  if (cause instanceof ApiError) {
    if (cause.status === 404) return "not_found";
    if (cause.status === 403) return "permission_denied";
  }
  return "error";
}

export function failQualityResults(quality: BuildQualityResponse | null | undefined): QualityCheckResult[] {
  if (!quality) return [];
  return Object.values(quality.quality_results).flat().filter((result) => result.status === "fail");
}
