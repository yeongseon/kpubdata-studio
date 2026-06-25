/**
 * New Build 초안을 브라우저 localStorage에 저장/복원하는 유틸 (#10, #84).
 *
 * 작성 중인 빌드 초안을 임시 저장해 두고, 새로고침하거나 나중에 다시 열어 이어서
 * 편집할 수 있게 한다. 저장 시 `{version, data, savedAt}` 봉투(envelope)로 감싸고, 복원 시
 * 버전과 (선택적) zod 스키마로 검증해 버전 불일치/손상된 값은 조용히 무시·정리한다.
 * localStorage 접근 실패(SSR/프라이빗 모드 등)도 안전한 기본값(null/false)으로 폴백한다.
 */
const DRAFT_KEY = "kpubdata-studio:new-build-draft";

/** 초안 봉투 스키마 버전. 호환되지 않게 형태가 바뀌면 올린다. */
export const DRAFT_VERSION = 1;

/** localStorage에 저장되는 초안 봉투 구조. */
interface DraftEnvelope<T> {
  /** 봉투 스키마 버전 */
  version: number;
  /** 실제 초안 데이터 */
  data: T;
  /** 저장 시각 ISO 문자열 */
  savedAt: string;
}

/** zod 스키마의 `safeParse`만 의존하는 최소 검증 인터페이스. */
interface DraftValidator<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
}

/**
 * 초안 값을 버전 봉투로 감싸 저장한다. 실패 시 조용히 무시한다.
 *
 * @param value - 직렬화 가능한 초안 값.
 */
export function saveDraft<T>(value: T): void {
  try {
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_VERSION,
      data: value,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage 사용 불가 시 무시.
  }
}

/**
 * 저장된 초안을 불러온다. 없거나 손상되면 null을 반환한다.
 *
 * 봉투 버전이 현재 버전과 다르거나, (검증기 제공 시) 데이터가 스키마를 통과하지 못하면
 * 손상된 값으로 보고 정리한 뒤 null을 반환한다.
 *
 * @param validator - 데이터를 검증할 zod 스키마(선택). 미제공 시 버전만 확인한다.
 * @returns 저장된 초안 값 또는 null.
 */
export function loadDraft<T>(validator?: DraftValidator<T>): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as DraftEnvelope<unknown>).version !== DRAFT_VERSION
    ) {
      // 버전 불일치/봉투 아님: 안전하게 정리.
      clearDraft();
      return null;
    }
    const data = (parsed as DraftEnvelope<unknown>).data;
    if (validator) {
      const result = validator.safeParse(data);
      if (!result.success) {
        clearDraft();
        return null;
      }
      return result.data;
    }
    return data as T;
  } catch {
    return null;
  }
}

/**
 * 저장된 초안을 삭제한다.
 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 무시.
  }
}

/**
 * 저장된 초안이 존재하는지 확인한다.
 *
 * @returns 초안 존재 여부.
 */
export function hasDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}
