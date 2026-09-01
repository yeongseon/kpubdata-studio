/**
 * 현재 라우트를 `KubiContext`(#256)로 변환하는 resolver.
 *
 * "현재 실제 route에서 얻을 수 있는 context"만 구성한다 — Dataset Detail/Quality가 쓰는
 * `?run=&source=&stage=` 쿼리 관례(#253/#254)를 그대로 재사용하고, 그 밖의 값(예: 아직
 * fetch하지 않은 dataset의 provider)은 추측해서 채우지 않는다. `qualityResultIds`는 route만으로
 * 알 수 없으므로 evidence가 로드된 뒤 `useKubiSession`이 별도로 채운다.
 */
import { KUBI_STAGES } from "./schema";
import type { KubiContext, KubiStage } from "./types";

interface RouteMatch {
  test: RegExp;
  page: string;
  label: string;
}

// 순서 중요: 더 구체적인 패턴(하위 경로)을 먼저 매치해야 한다(#247 ROUTE_LABELS와 동일 원칙).
const ROUTES: RouteMatch[] = [
  { test: /^\/$/, page: "home", label: "Home" },
  { test: /^\/discover(\/|$)/, page: "discover", label: "Discover" },
  { test: /^\/workspace(\/|$)/, page: "workspace", label: "Workspace" },
  { test: /^\/add(\/|$)/, page: "add-data", label: "Add Data" },
  { test: /^\/datasets\/[^/]+/, page: "dataset-detail", label: "Dataset 상세" },
  { test: /^\/datasets(\/|$)/, page: "dataset-catalog", label: "Dataset Catalog" },
  { test: /^\/builds\/new(\/|$)/, page: "build-new", label: "새 빌드" },
  { test: /^\/builds\/[^/]+\/run(\/|$)/, page: "build-run", label: "빌드 실행" },
  { test: /^\/builds\/[^/]+\/artifacts(\/|$)/, page: "build-artifacts", label: "빌드 결과물" },
  { test: /^\/builds\/[^/]+\/publish(\/|$)/, page: "build-publish", label: "빌드 게시" },
  { test: /^\/builds\/[^/]+\/edit(\/|$)/, page: "build-edit", label: "빌드 편집" },
  { test: /^\/builds\/[^/]+(\/|$)/, page: "build-detail", label: "빌드 상세" },
  { test: /^\/builds(\/|$)/, page: "builds", label: "Builds / Runs" },
  { test: /^\/quality(\/|$)/, page: "quality", label: "Quality" },
  { test: /^\/kubi(\/|$)/, page: "kubi", label: "Kubi" },
  { test: /^\/reports(\/|$)/, page: "reports", label: "Reports" },
  { test: /^\/provider(\/|$)/, page: "provider", label: "Provider" },
  { test: /^\/monitoring(\/|$)/, page: "monitoring", label: "Monitoring" },
  { test: /^\/settings(\/|$)/, page: "settings", label: "Settings" },
  { test: /^\/validate(\/|$)/, page: "validate", label: "검증" },
  { test: /^\/preview(\/|$)/, page: "preview", label: "미리보기" },
  { test: /^\/artifacts(\/|$)/, page: "artifacts", label: "결과물" },
];

function isKubiStage(value: string | null): value is KubiStage {
  return value !== null && (KUBI_STAGES as readonly string[]).includes(value);
}

/** App Shell 수준에서 필요한 최소 Kubi route context(#247 KubiRouteContext와 동일 목적). */
export interface KubiRouteResolution {
  context: KubiContext;
  /** drawer 헤더에 표시할, 사람이 읽는 현재 화면 이름 */
  pageLabel: string;
  /** URL의 run 파라미터가 이 화면에서 유효한 문맥 값인지(현재는 항상 true — route parsing만 수행) */
  pathname: string;
}

/**
 * 현재 pathname + search를 `KubiContext`로 변환한다.
 *
 * @param pathname - 현재 경로(예: `/datasets/abc`).
 * @param search - 현재 querystring(예: `?run=r1&stage=silver`, 선행 `?` 포함/미포함 모두 허용).
 * @returns route에서 얻을 수 있는 KubiContext와 화면 라벨.
 */
export function resolveKubiContext(pathname: string, search = ""): KubiRouteResolution {
  const matched = ROUTES.find((entry) => entry.test.test(pathname));
  const page = matched?.page ?? "other";
  const pageLabel = matched?.label ?? pathname;

  const params = new URLSearchParams(search);

  const datasetMatch = pathname.match(/^\/datasets\/([^/]+)/);
  const buildMatch = pathname.match(/^\/builds\/([^/]+)/);
  const buildId = buildMatch && buildMatch[1] !== "new" ? decodeURIComponent(buildMatch[1]) : undefined;

  const datasetId = datasetMatch
    ? decodeURIComponent(datasetMatch[1])
    : (params.get("dataset") ?? undefined);
  // Dataset Detail/Quality 둘 다 build/run 식별자를 `run` 쿼리로 쓴다(#253/#254 관례).
  // Build 라우트에서는 경로의 buildId 자체가 run_id다(Builder가 run_id를 산출물 디렉터리에 씀).
  const runId = buildId ?? (params.get("run") ?? undefined);
  const stageParam = params.get("stage");
  const stage = isKubiStage(stageParam) ? stageParam : undefined;
  // Dataset Detail/Quality가 선택된 소스를 `?source=`로 실어 보낸다(#253/#254). 빈 문자열
  // ("전체 소스")은 명시적 선택이므로 context로는 넘기지 않는다.
  const source = params.get("source") || undefined;

  const context: KubiContext = {
    page,
    ...(datasetId ? { datasetId } : {}),
    ...(runId ? { runId } : {}),
    ...(stage ? { stage } : {}),
    ...(source ? { source } : {}),
  };

  return { context, pageLabel, pathname };
}

/** 두 KubiContext가 (page/datasetId/runId/stage 기준으로) 같은 문맥을 가리키는지 비교한다. */
export function contextsMatch(a: KubiContext, b: KubiContext): boolean {
  return (
    a.page === b.page &&
    (a.datasetId ?? null) === (b.datasetId ?? null) &&
    (a.runId ?? null) === (b.runId ?? null) &&
    (a.stage ?? null) === (b.stage ?? null) &&
    (a.source ?? null) === (b.source ?? null)
  );
}
