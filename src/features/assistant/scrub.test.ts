/**
 * 시크릿 스크러빙 회귀 테스트 (#226).
 *
 * 4결함 검증:
 * (a) 배열 순회 — BuildSpec.sources 가 배열
 * (c) restoreSecrets 왕복 — 배열 포함 복원
 * (d) Shannon 엔트로피 — 긴 base64 키 탐지
 */
import { describe, expect, it } from "vitest";

import {
  createSecretScrubber,
  hasSecretPlaceholder,
  looksLikeSecret,
  restoreSecrets,
  scrubSecrets,
} from "./scrub";

const SAMPLE_SERVICE_KEY =
  "9dF8kQ2mZ7xV3nL1pR4wY6tB0hJ5sC8gU2iE7oA9bN3cM6dP4qK1rS8tU0vW3xY5z";

describe("scrubSecrets — 배열 순회 회귀 (#226 결함 a)", () => {
  it("BuildSpec.sources 배열 내부의 serviceKey를 스크러빙한다", () => {
    const spec = {
      sources: [
        { provider: "datago", params: { serviceKey: SAMPLE_SERVICE_KEY } },
      ],
    };
    const { scrubbed, placeholders } = scrubSecrets(spec);

    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain(SAMPLE_SERVICE_KEY);
    expect(placeholders.size).toBeGreaterThan(0);
    expect(Array.from(placeholders.values())).toContain(SAMPLE_SERVICE_KEY);
  });

  it("다중 소스 배열의 각 원소를 독립적으로 순회한다", () => {
    const spec = {
      sources: [
        { params: { serviceKey: SAMPLE_SERVICE_KEY } },
        { params: { apiKey: "another-secret-value-1234567890abcdef" } },
      ],
    };
    const { scrubbed } = scrubSecrets(spec);
    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain(SAMPLE_SERVICE_KEY);
    expect(json).not.toContain("another-secret-value-1234567890abcdef");
  });

  it("중첩 배열(배열 안 객체 안 배열)도 순회한다", () => {
    const spec = {
      sources: [{ tags: [{ secret: SAMPLE_SERVICE_KEY }] }],
    };
    const { scrubbed } = scrubSecrets(spec);
    expect(JSON.stringify(scrubbed)).not.toContain(SAMPLE_SERVICE_KEY);
  });
});

describe("restoreSecrets — 배열 왕복 회귀 (#226 결함 c)", () => {
  it("scrub → restore가 배열을 포함한 원본을 완전히 복원한다", () => {
    const original = {
      sources: [{ params: { serviceKey: SAMPLE_SERVICE_KEY } }],
    };
    const { scrubbed, placeholders } = scrubSecrets(original);
    const restored = restoreSecrets(scrubbed, placeholders);
    expect(restored).toEqual(original);
  });

  it("중첩 배열도 왕복 복원된다", () => {
    const original = {
      sources: [{ tags: [{ secret: SAMPLE_SERVICE_KEY }] }],
    };
    const { scrubbed, placeholders } = scrubSecrets(original);
    const restored = restoreSecrets(scrubbed, placeholders);
    expect(restored).toEqual(original);
  });

  it("다른 요청이 만든 플레이스홀더를 복원하지 않는다", () => {
    const requestA = createSecretScrubber("request-a");
    const requestB = createSecretScrubber("request-b");
    const scrubbed = requestA.scrub({ serviceKey: "test-key" }) as {
      serviceKey: string;
    };

    expect(() => requestB.restore(scrubbed)).toThrow("알 수 없는 시크릿");
  });

  it("문자열 응답의 알려진 플레이스홀더만 복원한다", () => {
    const scrubber = createSecretScrubber("request-a");
    const scrubbed = scrubber.scrub({ serviceKey: "test-key" }) as {
      serviceKey: string;
    };

    expect(scrubber.restoreText(`serviceKey: ${scrubbed.serviceKey}`)).toBe(
      "serviceKey: test-key",
    );
    expect(() => scrubber.restoreText("__SCRUBBED_request-b_0__")).toThrow(
      "알 수 없는 시크릿",
    );
    expect(hasSecretPlaceholder(scrubbed)).toBe(true);
  });
});

describe("looksLikeSecret — Shannon 엔트로피 (#226 결함 d)", () => {
  it("짧은 값은 잡지 않는다 (MIN_LENGTH_FOR_ENTROPY 미만)", () => {
    expect(looksLikeSecret("short")).toBe(false);
  });

  it("200자 고엔트로피 base64 문자열을 잡아낸다 (현재 unique/length로는 32%라 놓침)", () => {
    // base64 고유 문자 ≤ 64개, 길이 192 → unique/length*100 ≈ 33% < 60 (현재)
    // Shannon 엔트로피는 문자 빈도 분포를 반영해 높게 계산
    const longB64 =
      "dGhpcy1pcy1hLXZlcnktbG9uZy1iYXNlNjQtc3RyaW5nLXdoaWNoLXNo" +
      "b3VsZC1ub3QtYmUtY2F1Z2h0LWJ5LXRoZS1jdXJyZW50LWhldXJpc3Rp" +
      "Yy1iZWNhdXNlLWl0LWlzLWxvbmctYW5kLXZhcmlk";
    expect(looksLikeSecret(longB64)).toBe(true);
  });

  it("반복 패턴 저엔트로피 문자열은 잡지 않는다", () => {
    expect(looksLikeSecret("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});
