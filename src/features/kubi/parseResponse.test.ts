import { describe, expect, it } from "vitest";
import { parseKubiResponse } from "./parseResponse";

const VALID_JSON = {
  answer: "안녕하세요",
  evidenceRefs: [{ kind: "dataset", id: "d1", label: "d1" }],
  generatedSql: null,
  suggestedActions: [],
};

describe("parseKubiResponse (#256)", () => {
  it("parses a fenced ```json block", () => {
    const raw = `여기 답변입니다.\n\n\`\`\`json\n${JSON.stringify(VALID_JSON)}\n\`\`\`countertext`;
    const result = parseKubiResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.answer).toBe("안녕하세요");
  });

  it("parses bare JSON with no fence", () => {
    const result = parseKubiResponse(JSON.stringify(VALID_JSON));
    expect(result.ok).toBe(true);
  });

  it("rejects empty output", () => {
    const result = parseKubiResponse("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects non-JSON garbage", () => {
    const result = parseKubiResponse("죄송합니다, 답변을 드릴 수 없습니다.");
    expect(result.ok).toBe(false);
  });

  it("rejects a JSON object missing required fields (zod shape check)", () => {
    const result = parseKubiResponse(JSON.stringify({ answer: "x" }).replace('"answer"', '"notanswer"'));
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown suggestedAction type (allowlist enforcement)", () => {
    const payload = {
      ...VALID_JSON,
      suggestedActions: [{ type: "RUN_BUILD", reason: "자동 실행해볼게요" }],
    };
    const result = parseKubiResponse(JSON.stringify(payload));
    expect(result.ok).toBe(false);
  });

  it("rejects a forbidden action disguised as an allowed type with extra fields", () => {
    // 예: PATCH_BUILDSPEC이지만 patch가 비어있어 아무 의미 없는 케이스는 min(1)로 거부되어야 한다.
    const payload = {
      ...VALID_JSON,
      suggestedActions: [{ type: "PATCH_BUILDSPEC", runId: "r1", patch: [], reason: "..." }],
    };
    const result = parseKubiResponse(JSON.stringify(payload));
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed OPEN_BUILD action", () => {
    const payload = {
      ...VALID_JSON,
      suggestedActions: [{ type: "OPEN_BUILD", runId: "run-1", reason: "실패 원인을 보여줄게요" }],
    };
    const result = parseKubiResponse(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.suggestedActions).toHaveLength(1);
  });

  it("defaults missing optional fields (evidenceRefs/generatedSql/suggestedActions)", () => {
    const result = parseKubiResponse(JSON.stringify({ answer: "간단 답변" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.evidenceRefs).toEqual([]);
      expect(result.response.generatedSql).toBeNull();
      expect(result.response.suggestedActions).toEqual([]);
    }
  });
});
