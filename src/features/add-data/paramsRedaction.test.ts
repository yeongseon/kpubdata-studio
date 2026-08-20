/**
 * Public API sourceParams secret redaction (#283 후속 리뷰 §1).
 *
 * `features/assistant/scrub.ts`의 기존 detector(`isSecretKey`/`looksLikeSecret`)를
 * 재사용해 key/value 단위로만 판정한다는 계약을 검증한다 — 새 secret detection
 * regex를 여기서 다시 만들지 않는다.
 */
import { describe, expect, it } from "vitest";
import { PARAMS_REDACTED_SENTINEL, redactSourceParamsObject, redactSourceParamsText, sourceParamsHasRedactedSecret } from "./paramsRedaction";

const SECRET = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";

describe("redactSourceParamsObject", () => {
  it("serviceKey 값을 sentinel로 바꾼다", () => {
    const result = redactSourceParamsObject({ page: "1", serviceKey: SECRET });
    expect(result.hadSecret).toBe(true);
    expect(result.params.serviceKey).toBe(PARAMS_REDACTED_SENTINEL);
    expect(result.params.page).toBe("1");
  });

  it("api_key 값을 sentinel로 바꾸고 비민감 값(region)은 유지한다", () => {
    const result = redactSourceParamsObject({ api_key: SECRET, region: "seoul" });
    expect(result.params.api_key).toBe(PARAMS_REDACTED_SENTINEL);
    expect(result.params.region).toBe("seoul");
  });

  it("key 이름이 평범해도 고엔트로피 값이면 redact한다", () => {
    const highEntropy = "Zx8pQ2vR7mK4nL9wT1yB6cU3sD0fH5jA8gE2rN7iM4x";
    const result = redactSourceParamsObject({ auth: highEntropy });
    expect(result.hadSecret).toBe(true);
    expect(result.params.auth).toBe(PARAMS_REDACTED_SENTINEL);
  });

  it("비민감 파라미터만 있으면 손대지 않는다", () => {
    const result = redactSourceParamsObject({ region: "seoul", year: "2024" });
    expect(result.hadSecret).toBe(false);
    expect(result.params).toEqual({ region: "seoul", year: "2024" });
  });

  it("정상 값이 우연히 sentinel과 무관한 흔한 단어('REDACTED')여도 그대로 유지한다 (#283 후속 리뷰 §3)", () => {
    const result = redactSourceParamsObject({ status: "REDACTED" });
    expect(result.hadSecret).toBe(false);
    expect(result.params.status).toBe("REDACTED");
  });
});

describe("redactSourceParamsText", () => {
  it("JSON으로 파싱되면 secret 값만 가리고 나머지 텍스트 구조는 보존한다", () => {
    const result = redactSourceParamsText(JSON.stringify({ page: 1, serviceKey: SECRET }));
    expect(result.hadSecret).toBe(true);
    expect(result.text).not.toContain(SECRET);
    expect(result.text).toContain("\"page\": 1");
  });

  it("secret이 없으면 원문 텍스트를 그대로 돌려준다(포맷 변경 없음)", () => {
    const raw = '{"region":"seoul"}';
    const result = redactSourceParamsText(raw);
    expect(result.hadSecret).toBe(false);
    expect(result.text).toBe(raw);
  });

  it("빈 문자열은 그대로 둔다", () => {
    expect(redactSourceParamsText("")).toEqual({ text: "", hadSecret: false });
  });

  it("JSON으로 파싱할 수 없는 값은 통째로 sentinel로 fail-closed 처리한다", () => {
    const malformed = `{not json, token=${SECRET}`;
    const result = redactSourceParamsText(malformed);
    expect(result.hadSecret).toBe(true);
    expect(result.text).not.toContain(SECRET);
    expect(result.text).toBe(PARAMS_REDACTED_SENTINEL);
  });
});

describe("sourceParamsHasRedactedSecret", () => {
  it("sentinel이 남은 sourceParams를 감지한다", () => {
    const { text } = redactSourceParamsText(JSON.stringify({ serviceKey: SECRET }));
    expect(sourceParamsHasRedactedSecret(text)).toBe(true);
  });

  it("secret이 없던 원문은 false를 돌려준다", () => {
    expect(sourceParamsHasRedactedSecret('{"region":"seoul"}')).toBe(false);
  });
});
