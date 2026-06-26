/**
 * listBuilds 실연동 모드 분기 테스트 (#95).
 *
 * mock 모드에서는 결정적 mock 이력을 반환하고, 실연동 모드에서는 Builder에 아직 GET /builds가
 * 없으므로(builder #250) 가짜 이력 대신 빈 목록을 반환하는지 검증한다. 실연동 모드에서 mock
 * 데이터를 그대로 노출하면 사용자를 오도한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { listBuilds } from "@/features/runs/api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("listBuilds (#95)", () => {
  it("returns deterministic mock history in mock mode", async () => {
    const builds = await listBuilds();
    expect(builds.length).toBe(3);
    expect(builds.map((b) => b.spec.title)).toContain("대기오염 정보");
  });

  it("returns an empty list in real mode (no Builder GET /builds yet, builder #250)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const builds = await listBuilds();
    // 가짜 mock 이력을 실데이터처럼 노출하지 않는다.
    expect(builds).toEqual([]);
  });
});
