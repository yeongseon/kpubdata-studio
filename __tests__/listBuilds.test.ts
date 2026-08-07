/**
 * listBuilds 실연동 모드 분기 테스트 (#95, #102).
 *
 * mock 모드에서는 결정적 mock 이력을 반환하고, 실연동 모드에서는 Builder GET /builds를
 * 호출한다. Builder PR #251로 GET /builds가 추가되어 Studio와 연동되었다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/builderApi";
import { listBuilds } from "@/features/runs/api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("listBuilds (#95, #102)", () => {
  it("returns deterministic mock history in mock mode", async () => {
    const builds = await listBuilds();
    expect(builds.length).toBe(6);
    expect(builds.map((b) => b.spec.title)).toContain("대기오염 정보");
  });

  it("calls Builder GET /builds in real mode (Builder PR #251)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    // 실연동 모드에서는 Builder API를 호출하며, 테스트 환경에서는 연결 실패가 예상됨
    await expect(listBuilds()).rejects.toThrow(ApiError);
    await expect(listBuilds()).rejects.toThrow("Builder API에 연결하지 못했습니다.");
  });
});
