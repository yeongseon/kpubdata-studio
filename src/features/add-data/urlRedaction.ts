/**
 * URL source endpoint의 표시/저장용 secret redaction (PR #283 리뷰 대응, Epic #246).
 *
 * URL source는 별도 params 필드가 없고, secret이 endpoint 문자열 자체의 query
 * parameter에 섞여 들어온다(`?api_key=...`, `?serviceKey=...`). `features/assistant/
 * scrub.ts`의 key-name/entropy 기반 detector(`isSecretKey`/`looksLikeSecret`)를 그대로
 * 재사용해 query parameter "값"만 판정하고, hostname/path/비민감 parameter는 그대로
 * 둔다 — 새 secret detection 로직을 여기서 다시 만들지 않는다.
 *
 * 이 모듈은 표시/localStorage 저장 전용이다. 실제 Builder 제출값(`BuildSpec.sources[0]
 * .endpoint`)에는 절대 관여하지 않는다 — 호출부(`ReviewBuildStep`/`draftStorage`)가
 * redact된 사본만 만들어 쓰고, in-memory draft/spec은 원문 그대로 유지한다.
 */
import { isSecretKey, looksLikeSecret } from "@/features/assistant/scrub";

// 대괄호 없는 텍스트를 쓴다 — `URLSearchParams`가 값을 percent-encode하므로
// `[REDACTED]`를 쓰면 `%5BREDACTED%5D`로 보여 사람이 읽기 어렵다(#283 리뷰 대응).
export const REDACTED_PLACEHOLDER = "REDACTED";

export interface RedactedEndpoint {
  endpoint: string;
  hadSecret: boolean;
}

/**
 * endpoint의 query parameter 중 secret으로 판정되는 값만 `REDACTED`로 치환한다.
 * hostname/path/fragment/비민감 parameter는 그대로 유지한다(불필요한 제거 금지).
 *
 * `new URL()`이 파싱하지 못하는 값(입력 중인 임시 문자열 등)은 그대로 돌려준다 —
 * `buildSpecFromDraft`가 이미 https:// 형식을 별도로 강제하므로 여기서 다시 막지 않는다.
 */
export function redactUrlEndpoint(endpoint: string): RedactedEndpoint {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { endpoint, hadSecret: false };
  }

  let hadSecret = false;
  for (const [key, value] of Array.from(url.searchParams.entries())) {
    if (isSecretKey(key) || looksLikeSecret(value)) {
      url.searchParams.set(key, REDACTED_PLACEHOLDER);
      hadSecret = true;
    }
  }

  return { endpoint: url.toString(), hadSecret };
}

/**
 * 저장된 초안을 복원했을 때, endpoint의 query parameter 중 하나라도 이미 redact되어
 * 있는지(= 실제 secret 원문이 사라졌는지) 판정한다. Preview/Build를 fail-closed 시키는
 * 데 쓴다 — redacted placeholder를 실제 endpoint/credential처럼 제출하지 않기 위함.
 */
export function endpointHasRedactedSecret(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return Array.from(url.searchParams.values()).some((value) => value === REDACTED_PLACEHOLDER);
  } catch {
    return false;
  }
}
