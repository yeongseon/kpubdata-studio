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
    sourceKeys: new Set(["datago.air_quality"]),
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

  it("keeps generatedSql.source when it exactly matches a known canonical source_key", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver", source: "datago.air_quality" } }),
      makeEvidence(),
      makeKnownRefs({ sourceKeys: new Set(["datago.air_quality"]) }),
    );
    expect(result.response.generatedSql).toEqual({
      sql: "SELECT * FROM dataset",
      stage: "silver",
      source: "datago.air_quality",
    });
    expect(result.rejectedSqlReason).toBeUndefined();
  });

  it("validates generatedSql.source even when stage evidence is unavailable (uses knownRefs.sourceKeys)", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver", source: "datago__air" } }),
      makeEvidence({ stage: undefined, dataset: undefined }),
      makeKnownRefs({ sourceKeys: new Set(["datago.air_quality", "kma.weather"]) }),
    );
    // multi-source + 미검증 source → fail-closed (SQL 통째로 제외)
    expect(result.response.generatedSql).toBeNull();
    expect(result.rejectedSqlReason).toContain("datago__air");
  });

  it("drops only the source (keeps SQL) for a single-source run with an unverifiable source", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver", source: "datago__air" } }),
      makeEvidence({ stage: undefined }),
      makeKnownRefs({ sourceKeys: new Set(["datago.air_quality"]) }),
    );
    expect(result.response.generatedSql).toEqual({ sql: "SELECT * FROM dataset", stage: "silver", source: undefined });
    expect(result.rejectedSqlReason).toContain("Builder가 자동");
  });

  it("uses dataset.sources length as the single-source signal when no sourceKeys were collected", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver", source: "guessed.source" } }),
      makeEvidence({
        stage: undefined,
        dataset: {
          datasetId: "ds-1",
          title: "t",
          providers: ["datago"],
          sources: [{ provider: "datago", dataset: "air_quality" }],
          latestRunId: "run-1",
          status: "ready",
          updatedAt: null,
          totalRowCount: 0,
        },
      }),
      makeKnownRefs({ sourceKeys: new Set() }),
    );
    expect(result.response.generatedSql?.sql).toBe("SELECT * FROM dataset");
    expect(result.response.generatedSql?.source).toBeUndefined();
  });

  it("fail-closes (drops whole SQL) for a multi-source run when nothing verifies the source", () => {
    const result = crossCheckKubiResponse(
      makeResponse({ generatedSql: { sql: "SELECT * FROM dataset", stage: "silver", source: "guessed.source" } }),
      makeEvidence({
        stage: undefined,
        dataset: {
          datasetId: "ds-1",
          title: "t",
          providers: ["datago", "kma"],
          sources: [
            { provider: "datago", dataset: "air_quality" },
            { provider: "kma", dataset: "weather" },
          ],
          latestRunId: "run-1",
          status: "ready",
          updatedAt: null,
          totalRowCount: 0,
        },
      }),
      makeKnownRefs({ sourceKeys: new Set() }),
    );
    expect(result.response.generatedSql).toBeNull();
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
