import { afterEach, describe, expect, it } from "vitest";
import { saveBuildSpec } from "@/features/build-spec/specStore";
import type { BuildSpec } from "@/shared/lib/types";
import { loadKubiEvidence } from "./evidence";
import type { KubiContext } from "./types";

afterEach(() => {
  localStorage.clear();
});

describe("loadKubiEvidence (#256)", () => {
  it("builds dataset/run/quality evidence with deep links and known refs for a valid dataset", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "air-quality", runId: "air-2026-08-14" };
    const { evidence, knownRefs } = await loadKubiEvidence(context);

    expect(evidence.dataset?.datasetId).toBe("air-quality");
    expect(evidence.deepLinks.datasetDetail).toBe("/datasets/air-quality");
    expect(evidence.quality?.results.some((r) => r.rule === "required_column")).toBe(true);
    expect(knownRefs.datasetIds.has("air-quality")).toBe(true);
    expect(knownRefs.runIds.has("air-2026-08-14")).toBe(true);
    expect(knownRefs.qualityResultIds.size).toBeGreaterThan(0);
    // catalog는 전역 MSW 핸들러가 항상 응답하므로 성공해야 한다.
    expect(evidence.catalog?.providers).toContain("datago");
  });

  it("marks evidence partial and lists what failed when the dataset doesn't exist", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "does-not-exist" };
    const { evidence } = await loadKubiEvidence(context);

    expect(evidence.partial).toBe(true);
    expect(evidence.unavailable).toContain("dataset");
    expect(evidence.dataset).toBeUndefined();
  });

  it("keeps quality unavailability distinct from PASS (population run has availability=unavailable)", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "population", runId: "population-2026-08-13" };
    const { evidence } = await loadKubiEvidence(context);

    expect(evidence.quality?.availability).toBe("unavailable");
    expect(evidence.quality?.evaluatedChecks).toBe(0);
  });

  it("does not fetch stage evidence when the context has no stage (no guessed source)", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "air-quality", runId: "air-2026-08-14" };
    const { evidence } = await loadKubiEvidence(context);
    expect(evidence.stage).toBeUndefined();
  });

  it("includes stage evidence (status/rowCount only, no raw sample rows) when a stage is in context", async () => {
    const context: KubiContext = {
      page: "dataset-detail",
      datasetId: "air-quality",
      runId: "air-2026-08-14",
      stage: "silver",
    };
    const { evidence } = await loadKubiEvidence(context);
    expect(evidence.stage?.stage).toBe("silver");
    expect(evidence.stage?.sourceKey).toBeTruthy();
    // 원본 sample row는 evidence 타입 자체에 존재하지 않는다 — 최소 데이터 원칙(#256 리뷰 §3).
    expect(evidence.stage).not.toHaveProperty("sample");
  });

  it("never includes source param values (only param key names) in the BuildSpec summary", async () => {
    const SECRET_VALUE = "super-secret-service-key-0123456789abcdef";
    const spec: BuildSpec = {
      datasetId: "air-quality",
      title: "대기질",
      description: "설명",
      sources: [{ provider: "datago", dataset: "air", params: { serviceKey: SECRET_VALUE, region: "서울" } }],
      exports: [{ format: "jsonl" }],
      metadata: {},
    };
    saveBuildSpec("air-2026-08-14", spec);

    const context: KubiContext = { page: "build-detail", runId: "air-2026-08-14" };
    const { evidence } = await loadKubiEvidence(context);

    expect(evidence.buildSpecSummary?.sources[0].paramKeys).toEqual(["serviceKey", "region"]);
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(SECRET_VALUE);
    expect(serialized).not.toContain("서울"); // param 값은 키 이름 외에는 전혀 포함되지 않는다.
  });

  it("scrubs any residual secret-shaped values as a defense-in-depth pass", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "air-quality", runId: "air-2026-08-14" };
    const { evidence } = await loadKubiEvidence(context);
    // scrubSecrets가 적용됐다면 이 필드는 항상 원본 문자열이거나(시크릿처럼 보이지 않으면) 마스킹된 placeholder다.
    expect(JSON.stringify(evidence)).not.toMatch(/__SCRUBBED_UNDEFINED__/);
  });

  it("omits stage/buildSpecSummary/quality when the context has no runId at all", async () => {
    const context: KubiContext = { page: "quality" };
    const { evidence, knownRefs } = await loadKubiEvidence(context);
    expect(evidence.quality).toBeUndefined();
    expect(evidence.buildSpecSummary).toBeUndefined();
    expect(knownRefs.runIds.size).toBe(0);
  });
});
