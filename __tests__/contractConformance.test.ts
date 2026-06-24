/**
 * Builder API 계약 적합성 테스트 (#36).
 *
 * Studio가 의존하는 Builder 계약 버전과 엔드포인트 집합을 고정해, 한쪽이 바뀌면 CI에서
 * 깨지도록 한다. Builder 측 계약은 builder #209(API_CONTRACT_VERSION="1.0.0")가 소유한다.
 */
import { describe, expect, it } from "vitest";
import { API_CONTRACT_VERSION, builderApi } from "@/shared/lib/builderApi";

// Studio 클라이언트가 호출하는 Builder service 오퍼레이션(현재 구현 기준).
const EXPECTED_OPERATIONS = ["version", "validate", "preview", "build", "artifacts"] as const;

describe("Builder API contract conformance (#36)", () => {
  it("pins the contract version Studio targets (must match builder #209)", () => {
    expect(API_CONTRACT_VERSION).toBe("1.0.0");
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
