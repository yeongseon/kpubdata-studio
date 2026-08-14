/**
 * 현재 라우트를 전역 Kubi drawer가 표시할 최소 context로 변환한다 (#247).
 *
 * 전체 `KubiContext`(page/datasetId/runId/stage/qualityResultIds/provider)와 실제 서버 연동은
 * #256에서 구현한다. App Shell 단계에서는 "지금 어느 화면의 Kubi를 열었는지"를 drawer 헤더에
 * 보여주기 위한 최소 정보(화면 이름 + route param)만 계산한다.
 */

/** App Shell 수준에서 필요한 최소 Kubi route context. */
export interface KubiRouteContext {
  /** drawer 헤더에 표시할, 사람이 읽는 현재 화면 이름 */
  pageLabel: string;
  /** 현재 경로 */
  pathname: string;
  /** 경로에서 추출한 datasetId (Dataset Detail 등에서만 존재) */
  datasetId?: string;
  /** 경로에서 추출한 buildId (Build 상세/실행/결과물/게시 등에서만 존재) */
  buildId?: string;
}

const ROUTE_LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/discover(\/|$)/, label: "Discover" },
  { test: /^\/workspace(\/|$)/, label: "Workspace" },
  { test: /^\/add(\/|$)/, label: "Add Data" },
  { test: /^\/datasets\/[^/]+/, label: "Dataset 상세" },
  { test: /^\/datasets(\/|$)/, label: "Dataset Catalog" },
  { test: /^\/builds\/new(\/|$)/, label: "새 빌드" },
  { test: /^\/builds\/[^/]+\/run(\/|$)/, label: "빌드 실행" },
  { test: /^\/builds\/[^/]+\/artifacts(\/|$)/, label: "빌드 결과물" },
  { test: /^\/builds\/[^/]+\/publish(\/|$)/, label: "빌드 게시" },
  { test: /^\/builds\/[^/]+\/edit(\/|$)/, label: "빌드 편집" },
  { test: /^\/builds\/[^/]+(\/|$)/, label: "빌드 상세" },
  { test: /^\/builds(\/|$)/, label: "Builds / Runs" },
  { test: /^\/quality(\/|$)/, label: "Quality" },
  { test: /^\/kubi(\/|$)/, label: "Kubi" },
  { test: /^\/reports(\/|$)/, label: "Reports" },
  { test: /^\/provider(\/|$)/, label: "Provider" },
  { test: /^\/monitoring(\/|$)/, label: "Monitoring" },
  { test: /^\/settings(\/|$)/, label: "Settings" },
  { test: /^\/$/, label: "Home" },
];

/**
 * 현재 pathname을 Kubi drawer가 표시할 화면 이름과 관련 route param으로 변환한다.
 *
 * @param pathname - 현재 경로 (예: `/datasets/abc`).
 * @returns 화면 이름, datasetId, buildId를 담은 최소 context.
 */
export function resolveKubiRouteContext(pathname: string): KubiRouteContext {
  const matched = ROUTE_LABELS.find((entry) => entry.test.test(pathname));
  const datasetMatch = pathname.match(/^\/datasets\/([^/]+)/);
  const buildMatch = pathname.match(/^\/builds\/([^/]+)/);
  const buildId = buildMatch && buildMatch[1] !== "new" ? buildMatch[1] : undefined;

  return {
    pageLabel: matched?.label ?? pathname,
    pathname,
    datasetId: datasetMatch?.[1],
    buildId,
  };
}
