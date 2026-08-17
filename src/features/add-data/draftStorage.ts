/**
 * Add Data Workbench 초안 local auto-draft (#250).
 *
 * `features/build-spec/draftStorage.ts`의 저장/복원 로직을 그대로 재사용하고,
 * New Build Wizard와 겹치지 않는 별도 key만 바인딩한다(중복 구현 금지).
 */
import { clearDraft, hasDraft, loadDraft, saveDraft } from "@/features/build-spec/draftStorage";
import type { AddDataDraft } from "@/features/add-data/model";

const ADD_DATA_DRAFT_KEY = "kpubdata-studio:add-data-draft";

export function saveAddDataDraft(draft: AddDataDraft): void {
  saveDraft(draft, ADD_DATA_DRAFT_KEY);
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
