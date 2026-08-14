import { describe, expect, it } from "vitest";
import { crossCheckKubiResponse } from "./crossCheck";
import type { KubiEvidence, KubiKnownRefs, KubiStructuredResponse } from "./types";

function makeEvidence(overrides: Partial<KubiEvidence> = {}): KubiEvidence {
  return {
    fetchedAt: "2026-08-14T00:00:00.000Z",
    context: { page: "dataset-detail", datasetId: "ds-1", runId: "run-1", stage: "silver" },
    deepLinks: {},
    partial: false,
    unavailable: [],
    ...overrides,
  };
}

function makeKnownRefs(overrides: Partial<KubiKnownRefs> = {}): KubiKnownRefs {
  return {
    datasetIds: new Set(["ds-1"]),
    runIds: new Set(["run-1"]),
    providers: new Set(["datago"]),
    qualityResultIds: new Set(["src::missing::max_null_ratio::price"]),
    schemaDriftIds: new Set(["column_added::region"]),
    ...overrides,
  };
}

function makeResponse(overrides: Partial<KubiStructuredResponse> = {}): KubiStructuredResponse {
  return {
    answer: "요약 답변입니다.",
    evidenceRefs: [],
    generatedSql: null,
    suggestedActions: [],
    ...overrides,
  };
}

describe("crossCheckKubiResponse (#256 hallucination gate)", () => {
  it("keeps evidenceRefs that match known ids", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ evidenceRefs: [{ kind: "dataset", id: "ds-1", label: "ds-1" }] }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.evidenceRefs).toHaveLength(1);
    expect(result.rejectedRefs).toHaveLength(0);
  });

  it("drops a hallucinated dataset ref that doesn't exist in evidence", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ evidenceRefs: [{ kind: "dataset", id: "ghost-dataset", label: "존재하지 않음" }] }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.evidenceRefs).toHaveLength(0);
    expect(result.rejectedRefs[0]).toContain("ghost-dataset");
  });

  it("drops a hallucinated quality result ref", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ evidenceRefs: [{ kind: "quality", id: "made-up-rule", label: "가짜 규칙" }] }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.evidenceRefs).toHaveLength(0);
  });

  it("rejects OPEN_BUILD referencing an unknown run", () => {
    const result = crossCheckKubiResponse(
      makeResponse({
        suggestedActions: [{ type: "OPEN_BUILD", runId: "run-does-not-exist", reason: "확인해보세요" }],
      }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.suggestedActions).toHaveLength(0);
    expect(result.rejectedActions[0]).toContain("run-does-not-exist");
  });

  it("keeps OPEN_QUALITY referencing a known dataset/run", () => {
    const result = crossCheckKubiResponse(
      makeResponse({
        suggestedActions: [
          { type: "OPEN_QUALITY", datasetId: "ds-1", runId: "run-1", reason: "품질을 확인하세요" },
        ],
      }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.suggestedActions).toHaveLength(1);
  });

  it("rejects PATCH_BUILDSPEC when no buildSpecSummary is available (spec unrecoverable)", () => {
    const result = crossCheckKubiResponse(
      makeResponse({
        suggestedActions: [
          { type: "PATCH_BUILDSPEC", runId: "run-1", patch: [{ op: "replace", path: "/title", value: "x" }], reason: "..." },
        ],
      }),
      makeEvidence({ buildSpecSummary: undefined }),
      makeKnownRefs(),
    );
    expect(result.response.suggestedActions).toHaveLength(0);
    expect(result.rejectedActions[0]).toContain("PATCH_BUILDSPEC");
  });

  it("rejects CREATE_BUILD_DRAFT with a dataset not in the source catalog", () => {
    const result = crossCheckKubiResponse(
      makeResponse({
        suggestedActions: [
          {
            type: "CREATE_BUILD_DRAFT",
            values: { datasetId: "d2", title: "t", description: "d", provider: "datago", sourceDataset: "not_in_catalog" },
            reason: "새로 만들어보세요",
          },
        ],
      }),
      makeEvidence({ catalog: { providers: ["datago"], datasetsByProvider: { datago: ["air_quality"] } } }),
      makeKnownRefs(),
    );
    expect(result.response.suggestedActions).toHaveLength(0);
  });

  it("drops generatedSql when its stage doesn't match the current context stage", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "gold" } }),
      makeEvidence({ context: { page: "dataset-detail", datasetId: "ds-1", runId: "run-1", stage: "silver" } }),
      makeKnownRefs(),
    );
    expect(result.response.generatedSql).toBeNull();
    expect(result.rejectedSqlReason).toBeTruthy();
  });

  it("keeps generatedSql when stage matches", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver" } }),
      makeEvidence({ context: { page: "dataset-detail", datasetId: "ds-1", runId: "run-1", stage: "silver" } }),
      makeKnownRefs(),
    );
    expect(result.response.generatedSql).not.toBeNull();
  });

  it("does not discard the whole answer when some refs/actions are rejected", () => {
    const result = crossCheckKubiResponse(
      makeResponse({
        evidenceRefs: [{ kind: "dataset", id: "ghost", label: "ghost" }],
        suggestedActions: [{ type: "OPEN_BUILD", runId: "run-1", reason: "실제 run" }],
      }),
      makeEvidence(),
      makeKnownRefs(),
    );
    expect(result.response.answer).toBe("요약 답변입니다.");
    expect(result.response.suggestedActions).toHaveLength(1);
    expect(result.rejectedRefs).toHaveLength(1);
  });
});
