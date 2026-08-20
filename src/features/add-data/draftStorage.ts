/**
 * Add Data Workbench 초안 local auto-draft (#250).
 *
 * `features/build-spec/draftStorage.ts`의 저장/복원 로직을 그대로 재사용하고,
 * New Build Wizard와 겹치지 않는 별도 key만 바인딩한다(중복 구현 금지).
 *
 * url source의 endpoint, public_api source의 sourceParams는 secret을 담을 수
 * 있어(#283 리뷰 대응, Epic #246, 후속 리뷰 §1) localStorage에 평문으로 남지 않도록
 * 저장 직전에 sanitize한다. draft의 sourceKind가 현재 "url"/"public_api"가 아니어도
 * `draft.url.endpoint`/`draft.publicApi.sourceParams` 필드 자체는 남아있을 수
 * 있으므로(source 전환 시 이전 값을 지우지 않음) 값이 있으면 항상 sanitize한다.
 *
 * endpoint는 `redactUrlEndpoint`(표시용)가 아니라 `sanitizeUrlEndpointForStorage`를
 * 쓴다 — `new URL()`이 파싱하지 못하는 malformed 값(query parameter 경계를 알 수
 * 없는 값)이나 userinfo credential이 포함된 값은 표시용 함수가 원문/부분 redact만
 * 돌려줄 수 있어, 저장 경로는 별도로 fail-closed(빈 값)한다(#283 후속 리뷰 §2, §4).
 *
 * `buildSpecFromDraft`가 sanitize된 endpoint/sourceParams를 감지하면 fail-closed로
 * 재입력을 요구한다 — placeholder를 실제 값처럼 복원/제출하지 않는다.
 */
import { clearDraft, hasDraft, loadDraft, saveDraft } from "@/features/build-spec/draftStorage";
import { sanitizeUrlEndpointForStorage } from "@/features/add-data/urlRedaction";
import { redactSourceParamsObject, redactSourceParamsText } from "@/features/add-data/paramsRedaction";
import type { AddDataDraft } from "@/features/add-data/model";

const ADD_DATA_DRAFT_KEY = "kpubdata-studio:add-data-draft";

export function saveAddDataDraft(draft: AddDataDraft): void {
  const canonicalBase = draft.canonicalBase
    ? {
        ...draft.canonicalBase,
        sources: draft.canonicalBase.sources.map((source) => {
          if ((source.kind ?? "public_api") === "url" && source.endpoint) {
            return { ...source, endpoint: sanitizeUrlEndpointForStorage(source.endpoint) };
          }
          return { ...source, params: redactSourceParamsObject(source.params ?? {}).params };
        }),
      }
    : undefined;
  const safeDraft: AddDataDraft = {
    ...draft,
    canonicalBase,
    url: draft.url.endpoint
      ? { ...draft.url, endpoint: sanitizeUrlEndpointForStorage(draft.url.endpoint) }
      : draft.url,
    publicApi: draft.publicApi.sourceParams
      ? { ...draft.publicApi, sourceParams: redactSourceParamsText(draft.publicApi.sourceParams).text }
      : draft.publicApi,
  };
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
