/**
 * Kubi 프롬프트 조립 단위 테스트 (#256 review — Builder #504 contract: SQL은 logical relation
 * "dataset"만 조회해야 한다).
 */
import { describe, expect, it } from "vitest";
import { buildKubiMessages } from "./prompt";
import type { KubiEvidence } from "./types";

function baseEvidence(overrides: Partial<KubiEvidence> = {}): KubiEvidence {
  return {
    fetchedAt: "2026-08-14T00:00:00Z",
    context: { page: "dataset-detail", datasetId: "air-quality" },
    deepLinks: {},
    partial: false,
    unavailable: [],
    ...overrides,
  };
}

describe("buildKubiMessages (#256 프롬프트)", () => {
  it("states the logical relation \"dataset\" rule in the system prompt's response contract", () => {
    const [systemMessage] = buildKubiMessages("질문", baseEvidence());
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain('logical relation "dataset"');
    expect(systemMessage.content).toContain("source_key");
    expect(systemMessage.content).toContain("FROM dataset");
  });

  it("instructs that the real source_key must not be used as the SQL FROM table name", () => {
    const [systemMessage] = buildKubiMessages("질문", baseEvidence());
    expect(systemMessage.content).toContain("FROM의 테이블명으로 쓰지 마세요");
    expect(systemMessage.content).toContain("generatedSql.source 필드로만 전달");
  });

  it("keeps evidence and user question isolated as separate untrusted-data messages", () => {
    const evidence = baseEvidence({
      stage: { stage: "silver", sourceKey: "datago__air", status: "completed", available: true, rowCount: 10 },
    });
    const messages = buildKubiMessages("서울 데이터 보여줘", evidence);
    expect(messages).toHaveLength(3);
    expect(messages[1].content).toContain("EVIDENCE START");
    expect(messages[1].content).toContain("datago__air");
    expect(messages[2].content).toContain("USER QUESTION START");
    expect(messages[2].content).toContain("서울 데이터 보여줘");
  });
});
