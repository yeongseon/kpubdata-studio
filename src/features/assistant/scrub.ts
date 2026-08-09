/**
 * 시크릿 스크러빙 — LLM 전송 전 마스킹 (#206, ST-A3).
 *
 * sourceParams에 공공데이터포털 서비스 키 등이 들어갈 수 있다.
 * 이걸 그대로 LLM에 보내면 사용자 시크릿이 외부 사업자에게 전송된다.
 *
 * 호출 경로의 공통 계층에 두어 프록시 모드로 바뀌어도 우회되지 않게 한다.
 */

const SECRET_KEY_PATTERNS = [
  /^servicekey$/i,
  /^api[_-]?key$/i,
  /^.*[_-]?key$/i,
  /^.*[_-]?token$/i,
  /^.*[_-]?secret$/i,
];

const ENTROPY_THRESHOLD = 40;
const MIN_LENGTH_FOR_ENTROPY = 16;

export function isSecretKey(keyName: string): boolean {
  return SECRET_KEY_PATTERNS.some((p) => p.test(keyName));
}

export function looksLikeSecret(value: string): boolean {
  if (value.length < MIN_LENGTH_FOR_ENTROPY) return false;
  const unique = new Set(value).size;
  const entropy = (unique / value.length) * 100;
  return entropy > ENTROPY_THRESHOLD;
}

const SCRUBBED_PREFIX = "__SCRUBBED_";

export interface ScrubResult {
  scrubbed: unknown;
  placeholders: Map<string, string>;
}

export function scrubSecrets(data: unknown): ScrubResult {
  const placeholders = new Map<string, string>();
  let counter = 0;

  function scrubValue(key: string, value: unknown): unknown {
    if (typeof value === "string" && (isSecretKey(key) || looksLikeSecret(value))) {
      const placeholder = `${SCRUBBED_PREFIX}${counter++}__`;
      placeholders.set(placeholder, value);
      return placeholder;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = scrubValue(k, v);
      }
      return result;
    }
    return value;
  }

  const scrubbed = scrubValue("root", data);
  return { scrubbed, placeholders };
}

export function restoreSecrets(data: unknown, placeholders: Map<string, string>): unknown {
  if (typeof data === "string" && data.startsWith(SCRUBBED_PREFIX)) {
    return placeholders.get(data) ?? data;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = restoreSecrets(v, placeholders);
    }
    return result;
  }
  return data;
}
