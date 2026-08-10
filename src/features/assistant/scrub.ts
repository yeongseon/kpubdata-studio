/**
 * 시크릿 스크러빙 — LLM 전송 전 마스킹 (#206, ST-A3, #226).
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

// Shannon 엔트로피 임계 (bits/char). base64(≈6.0)/hex(=4.0) 키를 잡고
// 일반 텍스트는 놓친다. 이전 (unique/length)*100 휴리스틱은 길수록 고유 문자
// 비율이 떨어져 200자 base64 키를 32%로 계산해 놓쳤다 (#226 결함 d).
const SHANNON_ENTROPY_THRESHOLD = 4.0;
const MIN_LENGTH_FOR_ENTROPY = 24;

export function isSecretKey(keyName: string): boolean {
  return SECRET_KEY_PATTERNS.some((p) => p.test(keyName));
}

/**
 * Shannon 엔트로피(문자당 bits) 계산. 문자 빈도 분포를 반영해
 * 긴 고엔트로피 문자열(base64/hex 키)을 정확히 잡는다 (#226 결함 d).
 */
function shannonEntropy(value: string): number {
  const freq = new Map<string, number>();
  for (const ch of value) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let h = 0;
  for (const count of freq.values()) {
    const p = count / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function looksLikeSecret(value: string): boolean {
  if (value.length < MIN_LENGTH_FOR_ENTROPY) return false;
  return shannonEntropy(value) >= SHANNON_ENTROPY_THRESHOLD;
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
    // 배열도 순회한다 (#226 결함 a). BuildSpec.sources 가 배열이라
    // !Array.isArray(value) 분기가 재귀를 끊어 sources[].params.serviceKey 에
    // 도달하지 못했다.
    if (Array.isArray(value)) {
      return value.map((v, i) => scrubValue(`${key}[${i}]`, v));
    }
    if (value && typeof value === "object") {
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
  // 배열 왕복 복원 (#226 결함 c). scrub 가 배열을 순회하므로 restore 도 같이.
  if (Array.isArray(data)) {
    return data.map((v) => restoreSecrets(v, placeholders));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = restoreSecrets(v, placeholders);
    }
    return result;
  }
  return data;
}
