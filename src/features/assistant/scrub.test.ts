/**
 * 시크릿 스크러빙 회귀 테스트 (#226).
 *
 * 4결함 검증:
 * (a) 배열 순회 — BuildSpec.sources 가 배열
 * (c) restoreSecrets 왕복 — 배열 포함 복원
 * (d) Shannon 엔트로피 — 긴 base64 키 탐지
 */
import { describe, expect, it } from "vitest";

import { looksLikeSecret, restoreSecrets, scrubSecrets, scrubSecretsInText } from "./scrub";

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

describe("scrubSecretsInText — 자유 텍스트 토큰 단위 스크럽 (#277 리뷰)", () => {
  it("공백 없는 고엔트로피 토큰만 마스킹하고 나머지 문장은 그대로 둔다", () => {
    const text = `내 서비스 키는 ${SAMPLE_SERVICE_KEY} 입니다.`;
    const scrubbed = scrubSecretsInText(text);
    expect(scrubbed).not.toContain(SAMPLE_SERVICE_KEY);
    expect(scrubbed).toContain("내 서비스 키는");
    expect(scrubbed).toContain("입니다.");
  });

  it("공백 없이 통짜로 붙은 시크릿 값도 마스킹한다", () => {
    expect(scrubSecretsInText(SAMPLE_SERVICE_KEY)).not.toContain(SAMPLE_SERVICE_KEY);
  });

  it("정상 한국어 문장은 오탐하지 않는다(Kubi/AssistantChat 회귀)", () => {
    const text = "대기질 데이터셋의 최근 실행 상태를 알려줘. 지난주 대비 결측치가 늘었는지도 궁금해.";
    expect(scrubSecretsInText(text)).toBe(text);
  });

  it("정상 영어 문장도 오탐하지 않는다", () => {
    const text = "Please summarize the latest build failure and suggest the next action.";
    expect(scrubSecretsInText(text)).toBe(text);
  });
});
