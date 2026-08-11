/**
 * 컬럼 의미 해독 테스트 (AI-1, #228).
 *
 * 핵심: 샘플 값에 포함된 시크릿이 LLM 프롬프트에 노출되지 않는다.
 */
import { describe, expect, it } from "vitest";

import { buildColumnMeaningPrompt } from "./columnMeaning";

const SECRET_KEY =
  "9dF8kQ2mZ7xV3nL1pR4wY6tB0hJ5sC8gU2iE7oA9bN3cM6dP4qK1rS8tU0vW3xY5z";

describe("buildColumnMeaningPrompt — 스크러빙 (#228, SEC-2 선행)", () => {
  it("샘플 값의 serviceKey가 스크러빙된다", () => {
    const columns = [
      { name: "OPNSFTEAM_CODE", dtype: "String" },
      { name: "serviceKey", dtype: "String" },
    ];
    const rows = [
      { OPNSFTEAM_CODE: "3000000", serviceKey: SECRET_KEY },
      { OPNSFTEAM_CODE: "3000001", serviceKey: SECRET_KEY },
    ];

    const { messages, scrubbed } = buildColumnMeaningPrompt(columns, rows);

    expect(scrubbed).toBe(true);
    const promptText = messages.map((m) => m.content).join("\n");
    expect(promptText).not.toContain(SECRET_KEY);
  });

  it("컬럼 목록이 프롬프트에 포함된다", () => {
    const columns = [
      { name: "MTHDT", dtype: "String" },
      { name: "BUDGET_CRNTAM", dtype: "Int64" },
    ];
    const { messages } = buildColumnMeaningPrompt(columns, []);

    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("MTHDT");
    expect(userMsg?.content).toContain("BUDGET_CRNTAM");
  });

  it("시크릿이 없으면 scrubbed=false", () => {
    const columns = [{ name: "region", dtype: "String" }];
    const rows = [{ region: "서울" }];
    const { scrubbed } = buildColumnMeaningPrompt(columns, rows);
    expect(scrubbed).toBe(false);
  });
});
