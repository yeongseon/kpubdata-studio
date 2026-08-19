/**
 * URL source endpoint secret redaction (PR #283 리뷰 대응, Epic #246).
 *
 * `features/assistant/scrub.ts`의 기존 detector(`isSecretKey`/`looksLikeSecret`)를
 * 재사용해 query parameter 값만 판정한다는 계약을 검증한다 — 새 secret detection
 * regex를 여기서 다시 만들지 않는다.
 */
import { describe, expect, it } from "vitest";
import { endpointHasRedactedSecret, redactUrlEndpoint } from "./urlRedaction";

const SECRET = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";

describe("redactUrlEndpoint", () => {
  it("api_key query parameter 값을 [REDACTED]로 바꾼다", () => {
    const result = redactUrlEndpoint(`https://api.example.org/data?api_key=${SECRET}`);
    expect(result.hadSecret).toBe(true);
    expect(result.endpoint).not.toContain(SECRET);
    expect(result.endpoint).toContain("REDACTED");
  });

  it("serviceKey query parameter 값을 [REDACTED]로 바꾼다", () => {
    const result = redactUrlEndpoint(`https://api.data.go.kr/openapi?serviceKey=${SECRET}`);
    expect(result.hadSecret).toBe(true);
    expect(result.endpoint).not.toContain(SECRET);
  });

  it("token query parameter 값을 [REDACTED]로 바꾼다", () => {
    const result = redactUrlEndpoint(`https://api.example.org/v1?token=${SECRET}`);
    expect(result.hadSecret).toBe(true);
    expect(result.endpoint).not.toContain(SECRET);
  });

  it("key 이름이 평범해도 고엔트로피 값이면 redact한다", () => {
    const highEntropy = "Zx8pQ2vR7mK4nL9wT1yB6cU3sD0fH5jA8gE2rN7iM4x";
    const result = redactUrlEndpoint(`https://api.example.org/v1?auth=${highEntropy}`);
    expect(result.hadSecret).toBe(true);
    expect(result.endpoint).not.toContain(highEntropy);
  });

  it("일반 비민감 query parameter는 값을 바꾸지 않는다", () => {
    const result = redactUrlEndpoint("https://api.example.org/data?region=seoul&year=2024&page=1");
    expect(result.hadSecret).toBe(false);
    expect(result.endpoint).toBe("https://api.example.org/data?region=seoul&year=2024&page=1");
  });

  it("secret과 비민감 parameter가 섞이면 secret만 가리고 나머지는 유지한다", () => {
    const result = redactUrlEndpoint(`https://api.example.org/data?region=seoul&api_key=${SECRET}&year=2024`);
    expect(result.endpoint).not.toContain(SECRET);
    expect(result.endpoint).toContain("region=seoul");
    expect(result.endpoint).toContain("year=2024");
  });

  it("hostname/pathname은 그대로 유지한다", () => {
    const result = redactUrlEndpoint(`https://api.example.org/v1/data?api_key=${SECRET}`);
    expect(result.endpoint).toContain("api.example.org");
    expect(result.endpoint).toContain("/v1/data");
  });

  it("query parameter가 없으면 손대지 않는다", () => {
    const result = redactUrlEndpoint("https://api.example.org/data");
    expect(result.hadSecret).toBe(false);
    expect(result.endpoint).toBe("https://api.example.org/data");
  });

  it("파싱 불가능한 값은 원문 그대로 돌려준다(다른 곳에서 https:// 형식을 강제)", () => {
    const result = redactUrlEndpoint("not-a-url");
    expect(result).toEqual({ endpoint: "not-a-url", hadSecret: false });
  });
});

describe("endpointHasRedactedSecret", () => {
  it("redact된 endpoint를 복원 후 감지한다(placeholder를 실제 값처럼 쓰지 않기 위함)", () => {
    const { endpoint } = redactUrlEndpoint(`https://api.example.org/data?api_key=${SECRET}`);
    expect(endpointHasRedactedSecret(endpoint)).toBe(true);
  });

  it("secret이 없던 원문 endpoint는 false를 돌려준다", () => {
    expect(endpointHasRedactedSecret("https://api.example.org/data?region=seoul")).toBe(false);
  });
});
