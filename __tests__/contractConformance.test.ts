/**
 * Builder API 계약 적합성 테스트 (#36).
 *
 * Studio가 실제로 검토·연동한 Builder 계약 버전과 엔드포인트 집합을 고정해, 한쪽이
 * 바뀌면 CI에서 깨지도록 한다. 이 pin은 "Builder main의 최신 API_CONTRACT_VERSION과
 * 항상 exact-equality"를 뜻하지 않는다 — Builder는 additive 변경마다 버전을 계속
 * 올리므로(예: 1.8.0 — per-user provider credentials), Studio가 아직 구현/검토하지
 * 않은 operation까지 지원한다고 오인시키지 않도록 여기서는 마지막으로 검토한 버전만
 * 고정한다(Silver/Gold read-only `/query` 추가 — builder #504, API_CONTRACT_VERSION
 * "1.7.0"). Provider credentials API 연동은 Studio #259 범위이며 아직 여기 없다.
 * exact-equality pin 정책 자체를 versionless capability 협상으로 바꿀지는 builder
 * #521에서 논의 중이며, 이 테스트는 그 결정을 선점하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { API_CONTRACT_VERSION, builderApi } from "@/shared/lib/builderApi";

// Studio 클라이언트가 호출하는 Builder service 오퍼레이션(현재 구현 기준).
const EXPECTED_OPERATIONS = [
  "version",
  "validate",
  "preview",
  "build",
  "submitBuild",
  "getBuildJob",
  "artifacts",
  "listBuilds",
  "catalog",
  "listDatasets",
  "getDataset",
  "listDatasetRuns",
  "listBuildStages",
  "getBuildStageDetail",
  "getBuildQuality",
  "getDatasetQualityHistory",
  "query",
  "getBuildSpecSnapshot",
  "getBuildEvents",
] as const;

describe("Builder API contract conformance (#36)", () => {
  it("pins the last-reviewed contract version Studio targets (builder #209, #504, #480 async jobs, #487 spec snapshot, #488 stage summary, #486 quality, #496 structured events — Studio #255; drift beyond this — e.g. provider credentials, monitoring — is Studio #259/#264 scope, not auto-synced)", () => {
    expect(API_CONTRACT_VERSION).toBe("1.16.0");
  });

  it("exposes exactly the expected client operations", () => {
    expect(Object.keys(builderApi).sort()).toEqual([...EXPECTED_OPERATIONS].sort());
  });

  it("each operation is callable", () => {
    for (const op of EXPECTED_OPERATIONS) {
      expect(typeof builderApi[op]).toBe("function");
    }
  });
});
