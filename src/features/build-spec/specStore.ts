/**
 * 실행된 빌드의 BuildSpec을 run_id 기준으로 보관하는 로컬 저장소 (#120).
 *
 * Builder는 BuildSpec을 영속화하지 않는다. `/build`는 매 호출마다 spec YAML을 받아
 * 실행하고 버리며, manifest.json에도 spec은 남지 않는다. `GET /builds`가 돌려주는
 * 것도 `{run_id, status, started_at, finished_at}`뿐이다. 따라서 "기존 빌드를 불러와
 * 편집"하려면 Studio가 실행 시점의 spec을 스스로 기억해 두는 수밖에 없다.
 *
 * 한계를 분명히 해 둔다: 이 저장소는 브라우저 로컬이므로 다른 기기·브라우저에서 만든
 * 빌드나 CLI로 실행한 빌드는 편집할 수 없다. Builder에 spec 영속화와 개별 조회
 * 엔드포인트가 생기면 `loadBuildSpec`의 구현만 원격 호출로 교체하면 되도록,
 * 호출부는 이 모듈의 함수 시그니처에만 의존하게 한다.
 *
 * 저장 형태는 draftStorage와 같은 `{version, data, savedAt}` 봉투 규약을 따른다.
 */
import { buildSpecSchema } from "@/shared/lib/schemas";
import type { BuildSpec } from "@/shared/lib/types";

const SPEC_STORE_KEY = "kpubdata-studio:build-specs";

/** 저장 봉투 스키마 버전. 호환되지 않게 형태가 바뀌면 올린다. */
export const SPEC_STORE_VERSION = 1;

/**
 * 보관할 최대 항목 수.
 *
 * localStorage는 오리진당 수 MB 수준이라 무한정 쌓으면 다른 기능(초안 저장 등)의
 * 쓰기까지 QuotaExceededError로 막을 수 있다. 오래된 항목부터 버린다.
 */
export const SPEC_STORE_LIMIT = 50;

/** run_id별 저장 항목. */
interface SpecEntry {
  /** 실행에 사용된 빌드 스펙 */
  spec: unknown;
  /** 저장 시각 ISO 문자열 (오래된 항목 정리 기준) */
  savedAt: string;
}

/** localStorage에 저장되는 봉투 구조. */
interface SpecStoreEnvelope {
  version: number;
  entries: Record<string, SpecEntry>;
}

/**
 * 저장된 봉투를 읽는다. 없거나 버전이 다르거나 손상되면 빈 봉투를 반환한다.
 *
 * @returns 항상 사용 가능한 봉투(실패 시 빈 상태).
 */
function readEnvelope(): SpecStoreEnvelope {
  const empty: SpecStoreEnvelope = { version: SPEC_STORE_VERSION, entries: {} };
  try {
    const raw = localStorage.getItem(SPEC_STORE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as SpecStoreEnvelope).version !== SPEC_STORE_VERSION ||
      typeof (parsed as SpecStoreEnvelope).entries !== "object" ||
      (parsed as SpecStoreEnvelope).entries === null
    ) {
      // 버전 불일치/봉투 아님: 손상된 값이 계속 남지 않도록 정리한다.
      clearBuildSpecs();
      return empty;
    }
    return parsed as SpecStoreEnvelope;
  } catch {
    // localStorage 사용 불가(SSR/프라이빗 모드) 또는 JSON 파싱 실패.
    return empty;
  }
}

/**
 * 봉투를 저장한다. 실패 시 조용히 무시한다(저장 실패가 빌드 실행을 막으면 안 된다).
 *
 * @param envelope - 저장할 봉투.
 */
function writeEnvelope(envelope: SpecStoreEnvelope): void {
  try {
    localStorage.setItem(SPEC_STORE_KEY, JSON.stringify(envelope));
  } catch {
    // 용량 초과/사용 불가 시 무시.
  }
}

/**
 * 실행된 빌드의 스펙을 run_id에 묶어 저장한다.
 *
 * 같은 run_id로 다시 저장하면 덮어쓴다. 항목 수가 상한을 넘으면 `savedAt` 기준으로
 * 오래된 것부터 버린다.
 *
 * @param runId - 빌드 실행 식별자.
 * @param spec - 실행에 사용된 빌드 스펙.
 */
export function saveBuildSpec(runId: string, spec: BuildSpec): void {
  if (!runId) return;

  const envelope = readEnvelope();
  envelope.entries[runId] = { spec, savedAt: new Date().toISOString() };

  const keys = Object.keys(envelope.entries);
  if (keys.length > SPEC_STORE_LIMIT) {
    // savedAt 오름차순으로 정렬해 오래된 항목부터 제거한다.
    const ordered = keys.sort(
      (a, b) => envelope.entries[a].savedAt.localeCompare(envelope.entries[b].savedAt),
    );
    for (const key of ordered.slice(0, keys.length - SPEC_STORE_LIMIT)) {
      delete envelope.entries[key];
    }
  }

  writeEnvelope(envelope);
}

/**
 * run_id로 저장된 스펙을 불러온다.
 *
 * 저장 이후 스펙 스키마가 바뀌었을 수 있으므로 zod로 재검증한다. 통과하지 못한
 * 항목은 편집 폼을 깨뜨리기 전에 버린다.
 *
 * @param runId - 빌드 실행 식별자.
 * @returns 저장된 스펙, 없거나 더 이상 유효하지 않으면 null.
 */
export function loadBuildSpec(runId: string): BuildSpec | null {
  if (!runId) return null;

  const envelope = readEnvelope();
  const entry = envelope.entries[runId];
  if (!entry) return null;

  const result = buildSpecSchema.safeParse(entry.spec);
  if (!result.success) {
    delete envelope.entries[runId];
    writeEnvelope(envelope);
    return null;
  }
  return result.data;
}

/**
 * 저장된 스펙이 있는지 확인한다.
 *
 * @param runId - 빌드 실행 식별자.
 * @returns 편집 가능한 스펙 보유 여부.
 */
export function hasBuildSpec(runId: string): boolean {
  return loadBuildSpec(runId) !== null;
}

/**
 * 저장소 전체를 비운다.
 */
export function clearBuildSpecs(): void {
  try {
    localStorage.removeItem(SPEC_STORE_KEY);
  } catch {
    // 무시.
  }
}
