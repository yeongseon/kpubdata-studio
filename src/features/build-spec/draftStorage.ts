/**
 * New Build 초안을 브라우저 localStorage에 저장/복원하는 유틸 (#10).
 *
 * 작성 중인 빌드 초안을 임시 저장해 두고, 새로고침하거나 나중에 다시 열어 이어서
 * 편집할 수 있게 한다. localStorage 접근 실패(SSR/프라이빗 모드 등)나 깨진 JSON은
 * 조용히 무시하고 안전한 기본값(null/false)을 반환한다.
 */
const DRAFT_KEY = "kpubdata-studio:new-build-draft";

/**
 * 초안 값을 저장한다. 실패 시 조용히 무시한다.
 *
 * @param value - 직렬화 가능한 초안 값.
 */
export function saveDraft<T>(value: T): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  } catch {
    // localStorage 사용 불가 시 무시.
  }
}

/**
 * 저장된 초안을 불러온다. 없거나 손상되면 null을 반환한다.
 *
 * @returns 저장된 초안 값 또는 null.
 */
export function loadDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
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
