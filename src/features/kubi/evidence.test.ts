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
    expect(JSON.stringify(evidence)).not.toContain("__SCRUBBED_");
  });

  it("omits stage/buildSpecSummary/quality when the context has no runId at all", async () => {
    const context: KubiContext = { page: "quality" };
    const { evidence, knownRefs } = await loadKubiEvidence(context);
    expect(evidence.quality).toBeUndefined();
    expect(evidence.buildSpecSummary).toBeUndefined();
    expect(knownRefs.runIds.size).toBe(0);
  });
});

/**
 * Run provenance — knownRefs.runIds 와 safeRunIds 는 역할이 다르지만 provenance 계약은 같다
 * (#284 + 독립 리뷰 blocker).
 *
 * 두 Set 모두 "이번 evidence 로딩에서 Builder 응답으로 실제 존재가 확인된 run id" 만 담는다.
 * route/context.runId 는 evidence.context / deepLink 에는 남을 수 있어도, 존재가 확인되기
 * 전에는 knownRefs.runIds / safeRunIds 어디에도 들어가지 않는다.
 */
describe("loadKubiEvidence — run provenance (knownRefs.runIds / safeRunIds)", () => {
  it("Builder 응답(getDataset.latest_run_id / listDatasetRuns)이 확인한 run id 는 safeRunIds 에 들어간다", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "air-quality", runId: "air-2026-08-14" };
    const { knownRefs, safeRunIds } = await loadKubiEvidence(context);

    expect(safeRunIds.has("air-2026-08-14")).toBe(true);
    // listDatasetRuns 로 확인된 과거 run 도 포함.
    expect(safeRunIds.has("air-2026-08-13")).toBe(true);
    // safeRunIds ⊆ knownRefs.runIds (분리했지만 확인된 값은 양쪽 모두에 있다).
    for (const id of safeRunIds) expect(knownRefs.runIds.has(id)).toBe(true);
  });

  it("Builder 어느 응답에서도 확인되지 않은 route runId 는 knownRefs.runIds / safeRunIds 어디에도 없다", async () => {
    // datasetId 없음 → getDataset/listDatasetRuns 호출 안 함. quality/stage 는 이 run id 로 404.
    const unverified = "service-secret-production-abcdef-1788004513062";
    const context: KubiContext = { page: "build-detail", runId: unverified };
    const { knownRefs, safeRunIds } = await loadKubiEvidence(context);

    expect(safeRunIds.has(unverified)).toBe(false);
    expect(safeRunIds.size).toBe(0);
    // 독립 리뷰 blocker: route 값만으로는 knownRefs.runIds 에도 들어가지 않는다.
    expect(knownRefs.runIds.has(unverified)).toBe(false);
    expect(knownRefs.runIds.size).toBe(0);
  });

  it("확인되지 않은 저엔트로피 route runId 는 evidence.context/deepLink 에는 남지만 trust set 에는 안 들어간다", async () => {
    // 저엔트로피라 redactSecrets 가 마스킹하지 않으므로 context 잔존을 직접 확인할 수 있다.
    const unverified = "fake-run";
    const context: KubiContext = { page: "build-detail", runId: unverified };
    const { evidence, knownRefs, safeRunIds } = await loadKubiEvidence(context);

    expect(evidence.context.runId).toBe("fake-run");
    expect(evidence.deepLinks.buildDetail).toContain("fake-run");
    expect(knownRefs.runIds.has(unverified)).toBe(false);
    expect(safeRunIds.has(unverified)).toBe(false);
  });

  it("확인되지 않은 고엔트로피 route runId 는 evidence 에서 redact 된다(safeRunIds 로 면제하지 않으므로)", async () => {
    const unverified = "service-secret-production-abcdef-1788004513062";
    const context: KubiContext = { page: "build-detail", runId: unverified };
    const { evidence } = await loadKubiEvidence(context);

    // safeRunIds 가 비어 있으므로 이 고엔트로피 값은 엔트로피 오탐 면제를 받지 못하고 마스킹된다.
    expect(evidence.context.runId).toBe("[REDACTED]");
  });

  it("확인된(safe) 저엔트로피 run id 는 evidence 에 그대로 남는다", async () => {
    const context: KubiContext = { page: "dataset-detail", datasetId: "air-quality", runId: "air-2026-08-14" };
    const { evidence } = await loadKubiEvidence(context);
    expect(evidence.context.runId).toBe("air-2026-08-14");
    expect(evidence.deepLinks.buildDetail).toContain("air-2026-08-14");
  });

  it("getBuildQuality 가 이 run id 로 정상 응답하면 knownRefs/safeRunIds 양쪽에 추가한다(datasetId 없이도)", async () => {
    const context: KubiContext = { page: "build-detail", runId: "air-2026-08-14" };
    const { knownRefs, safeRunIds } = await loadKubiEvidence(context);
    expect(safeRunIds.has("air-2026-08-14")).toBe(true);
    expect(knownRefs.runIds.has("air-2026-08-14")).toBe(true);
  });
});
