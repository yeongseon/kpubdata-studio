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
//
// 프로젝트 전용으로 충분히 namespace한 값을 쓴다(#283 후속 리뷰 §3) — 예전에는 bare
// `REDACTED`를 썼는데, `?status=REDACTED`처럼 흔한 정상 API 값과 충돌해 credential이
// 사라진 것으로 오인할 수 있었다.
export const REDACTED_PLACEHOLDER = "__KPD_URL_SECRET_REDACTED__";

export interface RedactedEndpoint {
  endpoint: string;
  hadSecret: boolean;
}

/**
 * endpoint의 query parameter 중 secret으로 판정되는 값만 redact placeholder로
 * 치환하고, userinfo credential(`user:pass@host`)이 있으면 통째로 제거한다.
 * hostname/path/fragment/비민감 parameter는 그대로 유지한다(불필요한 제거 금지).
 *
 * URL Auth는 계약에 없는 기능이다(#283 후속 리뷰 §4) — userinfo를 지원하는 것처럼
 * 값을 가리기만 하고 남겨두지 않고 완전히 지운다.
 *
 * `new URL()`이 파싱하지 못하는 값(입력 중인 임시 문자열 등)은 그대로 돌려준다 —
 * `buildSpecFromDraft`가 이미 https:// 형식을 별도로 강제하므로 여기서 다시 막지 않는다.
 * (localStorage 저장 경로는 이 함수 대신 `sanitizeUrlEndpointForStorage`를 쓴다.)
 */
export function redactUrlEndpoint(endpoint: string): RedactedEndpoint {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { endpoint, hadSecret: false };
  }

  let hadSecret = false;
  if (url.username || url.password) {
    url.username = "";
    url.password = "";
    hadSecret = true;
  }
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

/**
 * endpoint에 userinfo credential(`https://user:pass@host/...`)이 포함됐는지 판정한다.
 * Auth=None 계약이며 URL Auth를 지원한다고 명시된 계약이 없으므로, 있으면 항상 오류로
 * 취급한다(#283 후속 리뷰 §4) — `buildSpecFromDraft`가 이 값으로 제출을 막는다.
 */
export function urlHasUserinfo(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.username !== "" || url.password !== "";
  } catch {
    return false;
  }
}

/**
 * localStorage에 저장하기 직전에만 쓰는 fail-closed sanitizer(#283 후속 리뷰 §2).
 *
 * `redactUrlEndpoint`(표시용)는 `new URL()`이 파싱하지 못하는 값을 원문 그대로 돌려준다
 * — Configure 단계에서 아직 완성되지 않은 입력값을 보여줄 때 쓰기 때문이다. 하지만
 * localStorage에 저장할 때 malformed 값(`not-a-url?token=...`처럼 query parameter
 * 경계를 알 수 없는 값)을 그대로 남기면 secret이 redact되지 않은 채 평문으로 남을 수
 * 있다. 그래서 저장 경로는 별도 함수로 분리해 파싱 실패 시 빈 값으로 되돌린다 —
 * `buildSpecFromDraft`의 https:// 검증이 자연히 재입력을 요구하게 된다.
 *
 * userinfo credential이 있는 URL도 같은 이유로 빈 값으로 되돌린다 — 자격 증명만 조용히
 * 지우고 나머지 endpoint를 저장하면, 사용자가 Auth가 적용된 채로 저장된 줄 착각할 수
 * 있다(#283 후속 리뷰 §4).
 */
export function sanitizeUrlEndpointForStorage(endpoint: string): string {
  try {
    new URL(endpoint);
  } catch {
    return "";
  }
  if (urlHasUserinfo(endpoint)) return "";
  return redactUrlEndpoint(endpoint).endpoint;
}
