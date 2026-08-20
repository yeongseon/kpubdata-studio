/**
 * Recent Work 조합 helper (#260).
 *
 * Dataset/Build(Builder 조회)와 Report/Saved BuildSpec(Studio local)을 하나의 목록으로
 * 합치되, 종류·출처(Builder vs 이 브라우저)·정확한 이동 경로를 각 항목에 명시적으로
 * 태그해 화면이 서로 다른 자산을 뭉뚱그리지 않게 한다. 순수 함수라 Builder 응답이나
 * localStorage를 직접 다루지 않는다 — 호출부가 이미 로드한 데이터를 넘겨준다.
 */
import type { DatasetSummary } from "@/shared/lib/builderApi";
import type { BuildListItem } from "@/shared/lib/types";
import type { ReportSummary } from "@/features/reports/types";
import type { SavedBuildSpecSummary } from "./types";

export type RecentWorkKind = "dataset" | "build" | "report" | "savedSpec";

export interface RecentWorkItem {
  kind: RecentWorkKind;
  id: string;
  title: string;
  /** 어디에 저장되어 있는지 — 화면에 "Builder"/"이 브라우저"로 구분 표시하기 위함. */
  source: "builder" | "local";
  /** 정렬 기준 시각. 없으면 null(추측하지 않음) — 목록 맨 뒤로 보낸다. */
  timestamp: string | null;
  /** 정확한 ID 기반 목적지. 제목/순서로 유추하지 않는다. */
  href: string;
}

function toMillis(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/** Build의 정렬 기준 시각: 실행 시작 시각을 우선하고, 없으면 종료 시각을 쓴다. */
function buildTimestamp(build: BuildListItem): string | null {
  return build.startedAt ?? build.finishedAt ?? null;
}

export interface RecentWorkSource {
  datasets: DatasetSummary[];
  builds: BuildListItem[];
  reports: ReportSummary[];
  savedSpecs: SavedBuildSpecSummary[];
}

/**
 * 네 종류의 원본 목록을 `RecentWorkItem[]`로 합치고, 시각 내림차순(최신 우선)으로 정렬한다.
 * 시각이 없는 항목은 맨 뒤로 보내되 원래 상대 순서를 유지한다(stable sort).
 */
export function toRecentWorkItems(source: RecentWorkSource): RecentWorkItem[] {
  const items: RecentWorkItem[] = [
    ...source.datasets.map(
      (dataset): RecentWorkItem => ({
        kind: "dataset",
        id: dataset.dataset_id,
        title: dataset.title,
        source: "builder",
        timestamp: dataset.updated_at,
        href: `/datasets/${encodeURIComponent(dataset.dataset_id)}`,
      }),
    ),
    ...source.builds.map(
      (build): RecentWorkItem => ({
        kind: "build",
        id: build.id,
        title: build.title ?? build.id,
        source: "builder",
        timestamp: buildTimestamp(build),
        href: `/builds/${encodeURIComponent(build.id)}`,
      }),
    ),
    ...source.reports.map(
      (report): RecentWorkItem => ({
        kind: "report",
        id: report.id,
        title: report.title,
        source: "local",
        timestamp: report.updatedAt,
        href: `/reports/${encodeURIComponent(report.id)}`,
      }),
    ),
    ...source.savedSpecs.map(
      (spec): RecentWorkItem => ({
        kind: "savedSpec",
        id: spec.id,
        title: spec.name,
        source: "local",
        timestamp: spec.updatedAt,
        href: `/builds/new?savedSpecId=${encodeURIComponent(spec.id)}`,
      }),
    ),
  ];

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const diff = toMillis(b.item.timestamp) - toMillis(a.item.timestamp);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ item }) => item);
}

/** 화면에 한 번에 노출할 Recent Work 최대 개수. 넘는 항목은 각 섹션 페이지에서 전체를 본다. */
export const RECENT_WORK_DISPLAY_LIMIT = 10;
