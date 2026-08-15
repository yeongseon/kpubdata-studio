import type {
  DatasetSourceRef,
  DatasetSummary,
  RunStageEntry,
  SourceStageStatus,
  StageStatus,
} from "@/shared/lib/builderApi";

export type DatasetStage = "bronze" | "silver" | "gold";

export const DATASET_STAGES: DatasetStage[] = ["bronze", "silver", "gold"];
export const STAGE_STATUSES: StageStatus[] = ["completed", "failed", "not_run", "unavailable"];

export interface DatasetStageSummary {
  label: "Bronze" | "Silver" | "Gold" | "Mixed / Partial" | "Mixed / Failed" | "Failed" | "Unavailable";
  tone: "bronze" | "silver" | "gold" | "warning" | "failed" | "muted";
  description: string;
}

export function uniqueProviders(sources: DatasetSourceRef[]): string[] {
  return [...new Set(sources.map((source) => source.provider))].sort((a, b) => a.localeCompare(b));
}

export function sourceLabel(source: DatasetSourceRef): string {
  return source.alias || `${source.provider}.${source.dataset}`;
}

export function isMixedStageMap(stages: Record<string, SourceStageStatus>): boolean {
  const signatures = Object.values(stages).map(
    (stage) => `${stage.bronze}/${stage.silver}/${stage.gold}`,
  );
  return new Set(signatures).size > 1;
}

export function datasetHasStageStatus(dataset: DatasetSummary, status: StageStatus): boolean {
  return Object.values(dataset.stages).some((sourceStages) =>
    DATASET_STAGES.some((stage) => sourceStages[stage] === status),
  );
}

/** Catalog에서는 source별 stage를 펼치지 않고 실제 상태를 한 개의 정직한 요약으로 표시한다. */
export function summarizeDatasetStages(stages: Record<string, SourceStageStatus>): DatasetStageSummary {
  const sources = Object.values(stages);
  if (sources.length === 0) {
    return { label: "Unavailable", tone: "muted", description: "stage 정보 없음" };
  }

  const hasFailed = sources.some((source) => DATASET_STAGES.some((stage) => source[stage] === "failed"));
  const mixed = isMixedStageMap(stages);
  if (hasFailed) {
    return {
      label: mixed ? "Mixed / Failed" : "Failed",
      tone: "failed",
      description: mixed ? "source별 진행 상태가 다르며 실패가 포함됨" : "stage 실패",
    };
  }
  if (mixed) {
    return { label: "Mixed / Partial", tone: "warning", description: "source별 진행 상태가 다름" };
  }

  const common = sources[0];
  if (common.gold === "completed") return { label: "Gold", tone: "gold", description: "Gold 완료" };
  if (common.silver === "completed") return { label: "Silver", tone: "silver", description: "Silver 완료" };
  if (common.bronze === "completed") return { label: "Bronze", tone: "bronze", description: "Bronze 완료" };
  if (DATASET_STAGES.some((stage) => common[stage] === "not_run")) {
    return { label: "Mixed / Partial", tone: "warning", description: "실행되지 않은 stage가 있음" };
  }
  return { label: "Unavailable", tone: "muted", description: "사용 가능한 stage 없음" };
}

export function highestCompletedStage(source: RunStageEntry): DatasetStage {
  if (source.gold.status === "completed") return "gold";
  if (source.silver.status === "completed") return "silver";
  if (source.bronze.status === "completed") return "bronze";
  return "bronze";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}
