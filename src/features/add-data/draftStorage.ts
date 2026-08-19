/**
 * Add Data Workbench 초안 local auto-draft (#250).
 *
 * `features/build-spec/draftStorage.ts`의 저장/복원 로직을 그대로 재사용하고,
 * New Build Wizard와 겹치지 않는 별도 key만 바인딩한다(중복 구현 금지).
 *
 * url source의 endpoint는 secret query parameter를 담을 수 있어(#283 리뷰 대응,
 * Epic #246) localStorage에 평문으로 남지 않도록 저장 직전에 redact한다. draft의
 * sourceKind가 현재 "url"이 아니어도 `draft.url.endpoint` 필드 자체는 남아있을 수
 * 있으므로(source 전환 시 이전 값을 지우지 않음) 값이 있으면 항상 redact한다.
 * `buildSpecFromDraft`가 redact된 endpoint를 감지하면 fail-closed로 재입력을
 * 요구한다 — placeholder를 실제 endpoint처럼 복원/제출하지 않는다.
 */
import { clearDraft, hasDraft, loadDraft, saveDraft } from "@/features/build-spec/draftStorage";
import { redactUrlEndpoint } from "@/features/add-data/urlRedaction";
import type { AddDataDraft } from "@/features/add-data/model";

const ADD_DATA_DRAFT_KEY = "kpubdata-studio:add-data-draft";

export function saveAddDataDraft(draft: AddDataDraft): void {
  const safeDraft: AddDataDraft = draft.url.endpoint
    ? { ...draft, url: { ...draft.url, endpoint: redactUrlEndpoint(draft.url.endpoint).endpoint } }
    : draft;
  saveDraft(safeDraft, ADD_DATA_DRAFT_KEY);
}

export function loadAddDataDraft(): AddDataDraft | null {
  // draft 형태는 자유롭게 진화할 수 있어(초기 버전) zod 스키마 없이 버전 봉투만 확인한다 —
  // 손상되거나 형태가 크게 다르면 loadDraft가 이미 null로 정리한다.
  return loadDraft<AddDataDraft>(undefined, ADD_DATA_DRAFT_KEY);
}

export function clearAddDataDraft(): void {
  clearDraft(ADD_DATA_DRAFT_KEY);
}

export function hasAddDataDraft(): boolean {
  return hasDraft(ADD_DATA_DRAFT_KEY);
}
