/**
 * Public API source의 sourceParams 표시/저장용 secret redaction (#283 후속 리뷰 §1).
 *
 * publicApi.sourceParams는 JSON 텍스트이고 공공데이터포털 serviceKey 등 credential이
 * 섞여 들어올 수 있다 — `features/assistant/scrub.ts` 자체도 이를 전제로 만들어졌다.
 * `urlRedaction.ts`가 URL endpoint의 query parameter에 적용한 것과 같은 원칙을
 * sourceParams 객체/JSON 텍스트에도 적용한다. 새 secret detection 로직을 만들지 않고
 * `features/assistant/scrub.ts`의 기존 detector(`isSecretKey`/`looksLikeSecret`)를
 * 그대로 재사용해 key/value 단위로만 판정한다.
 *
 * 이 모듈은 표시/localStorage 저장 전용이다. 실제 Builder 제출값(`BuildSpec.sources[0]
 * .params`)에는 절대 관여하지 않는다 — 호출부(`ReviewBuildStep`/`model.ts`의
 * `redactBuildSpecForDisplay`/`draftStorage`)가 redact된 사본만 만들어 쓰고, in-memory
 * draft/spec은 원문 그대로 유지한다.
 */
import { hasSecretPlaceholder, isSecretKey, looksLikeSecret, REDACTED_SECRET_MARKER } from "@/features/assistant/scrub";
import { REDACTED_PLACEHOLDER } from "@/features/add-data/urlRedaction";
import type { JsonValue } from "@/shared/lib/types";

// URL endpoint의 `REDACTED_PLACEHOLDER`(urlRedaction.ts)와 같은 이유로 프로젝트 전용
// namespace를 쓴다 — bare `REDACTED`는 `{"status":"REDACTED"}`같은 정상 API 값과
// 충돌할 수 있다(#283 후속 리뷰 §3와 동일 원칙).
export const PARAMS_REDACTED_SENTINEL = "__KPD_PARAMS_SECRET_REDACTED__";

export interface RedactedParams {
  params: Record<string, JsonValue>;
  hadSecret: boolean;
}

/**
 * source.params 객체(canonical BuildSpec의 `sources[0].params`)에서 secret으로
 * 판정되는 값만 sentinel로 치환한다. 비민감 key/value는 그대로 유지한다.
 */
export function redactSourceParamsObject(params: Record<string, JsonValue>): RedactedParams {
  let hadSecret = false;
  const visit = (value: JsonValue, key?: string): JsonValue => {
    if (key && isSecretKey(key)) {
      hadSecret = true;
      return PARAMS_REDACTED_SENTINEL;
    }
    if (typeof value === "string") {
      if (looksLikeSecret(value)) {
        hadSecret = true;
        return PARAMS_REDACTED_SENTINEL;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]));
    }
    return value;
  };
  const redacted = visit(params) as Record<string, JsonValue>;
  return { params: redacted, hadSecret };
}

export interface RedactedParamsText {
  text: string;
  hadSecret: boolean;
}

/**
 * `draft.publicApi.sourceParams`(Configure 단계 JSON textarea 원문)의 표시/저장용
 * redaction. JSON으로 정상 파싱되면 `redactSourceParamsObject`로 위임해 secret으로
 * 판정된 값만 가린다.
 *
 * JSON으로 파싱할 수 없는 값(입력 중인 임시 문자열 등)은 어느 부분이 key/value
 * 경계인지 신뢰성 있게 구분할 수 없으므로, 전체를 fail-closed로 sentinel 처리한다 —
 * URL endpoint의 malformed 저장 fail-closed(`sanitizeUrlEndpointForStorage`)와 같은
 * 원칙이다. 빈 문자열은 secret이 없으므로 그대로 둔다.
 */
export function redactSourceParamsText(sourceParams: string): RedactedParamsText {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceParams);
  } catch {
    return sourceParams.trim().length > 0
      ? { text: PARAMS_REDACTED_SENTINEL, hadSecret: true }
      : { text: sourceParams, hadSecret: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return sourceParams.trim().length > 0
      ? { text: PARAMS_REDACTED_SENTINEL, hadSecret: true }
      : { text: sourceParams, hadSecret: false };
  }

  const { params: redacted, hadSecret } = redactSourceParamsObject(parsed as Record<string, JsonValue>);
  if (!hadSecret) return { text: sourceParams, hadSecret: false };
  return { text: JSON.stringify(redacted, null, 2), hadSecret: true };
}

/**
 * 저장된 초안을 복원했을 때 sourceParams에 redaction marker가 남아있는지(= 실제 secret
 * 원문이 사라졌는지) 판정한다. `buildSpecFromDraft`/`toBuildSpec`을 fail-closed 시키는 데
 * 쓴다 — marker를 실제 파라미터 값처럼 Builder에 제출하지 않기 위함.
 *
 * persistence 경계에서 쓰이는 모든 marker를 한 곳에서 인식한다(S07 리뷰 §1):
 * `redactSourceParamsText`의 `__KPD_PARAMS_SECRET_REDACTED__`, URL query의
 * `__KPD_URL_SECRET_REDACTED__`, `redactSecrets()`의 종결 `[REDACTED]`, scrub 내부
 * `__SCRUBBED_*`.
 */
export function sourceParamsHasRedactedSecret(sourceParams: string): boolean {
  return (
    sourceParams.includes(PARAMS_REDACTED_SENTINEL) ||
    sourceParams.includes(REDACTED_PLACEHOLDER) ||
    hasSecretPlaceholder(sourceParams)
  );
}

export function jsonValueHasRedactedSecret(value: unknown): boolean {
  const serialized = JSON.stringify(value) ?? "";
  return (
    serialized.includes(PARAMS_REDACTED_SENTINEL) ||
    serialized.includes(REDACTED_PLACEHOLDER) ||
    serialized.includes(REDACTED_SECRET_MARKER) ||
    hasSecretPlaceholder(value)
  );
}
