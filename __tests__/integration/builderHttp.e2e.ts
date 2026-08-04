/**
 * Builder HTTP E2E 통합 테스트 (#160).
 *
 * 실제 Builder Docker 컨테이너와 HTTP 통신하는 테스트.
 * Studio의 builderApi를 통해 실제 요청을 전송하고 응답을 검증한다.
 *
 * 이 테스트는 다음을 요구한다:
 * - Builder Docker 컨테이너가 실행 중이어야 함
 * - VITE_BUILDER_API_URL이 Builder endpoint를 가리켜야 함
 * - VITE_USE_REAL_BUILDER=true 여야 함
 *
 * 실행 방법:
 *   npm run test:integration:builder:docker
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ApiError, builderApi, API_CONTRACT_VERSION } from "@/shared/lib/builderApi";

// Builder API URL 환경변수 확인
const BUILDER_URL = import.meta.env.VITE_BUILDER_API_URL;
const USE_REAL_BUILDER = import.meta.env.VITE_USE_REAL_BUILDER;

if (!BUILDER_URL || USE_REAL_BUILDER !== "true") {
  throw new Error(
    "Integration test requires VITE_BUILDER_API_URL and VITE_USE_REAL_BUILDER=true",
  );
}

describe("Builder HTTP E2E (#160)", () => {
  // 실패해도 결정적인 동작을 위한 고유 run ID
  const runId = `studio-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 외부 의존 없이 결정적으로 실패하는 BuildSpec
  const specYaml = `dataset_id: integration.offline
title: Offline integration fixture
description: Deterministic Builder HTTP integration fixture
sources:
  - provider: __integration_missing_provider__
    dataset: __integration_missing_dataset__
exports:
  - kind: jsonl
    output_path: out/data.jsonl
`;

  beforeAll(() => {
    console.log(`E2E test run ID: ${runId}`);
    console.log(`Builder URL: ${BUILDER_URL}`);
  });

  it("GET /version - 계약 버전 확인", async () => {
    const version = await builderApi.version();

    expect(version.service).toBe("kpubdata-builder");
    expect(version.api_version).toBe(API_CONTRACT_VERSION);
  });

  it("POST /validate - 구조 검증 통과", async () => {
    const validated = await builderApi.validate(specYaml);

    expect(validated).toEqual({
      status: "valid",
      dataset_id: "integration.offline",
      api_version: API_CONTRACT_VERSION,
    });
  });

  it("POST /build - 존재하지 않는 source로 502 실패", async () => {
    // Builder 계약: 실패 시 HTTP 502 + BuildFailureResponse 반환
    // Studio는 이를 ApiError(502)로 받아야 함

    const error = await builderApi.build(specYaml, runId).catch((cause) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);

    const details = (error as ApiError).details;
    expect(details).toBeDefined();
    expect(typeof details).toBe("object");

    // BuildFailureResponse 구조 검증
    expect((details as { status?: string }).status).toBe("failed");
    expect((details as { run_id?: string }).run_id).toBe(runId);
    expect((details as { outcomes?: unknown[] }).outcomes).toBeDefined();
    expect(Array.isArray((details as { outcomes?: unknown[] }).outcomes)).toBe(true);

    // 실패한 source가 outcomes에 존재해야 함
    const outcomes = (details as { outcomes?: Array<{ source_key?: string; status?: string }> }).outcomes || [];
    const failedSource = outcomes.find((o) => o.source_key === "__integration_missing_provider__.__integration_missing_dataset__");
    expect(failedSource).toBeDefined();
    expect(failedSource?.status).toBe("failed");
  });

  it("GET /artifacts/{run_id} - partial manifest 조회", async () => {
    // build 실패 후에도 partial manifest가 존재해야 함
    const artifacts = await builderApi.artifacts(runId);

    expect(artifacts.run_id).toBe(runId);
    expect(Array.isArray(artifacts.files)).toBe(true);
    // partial manifest가 있어야 함
    expect(artifacts.files).toContain("manifest.json");
  });

  it("GET /builds - 빌드 이력 목록에 실패 run 포함", async () => {
    const builds = await builderApi.listBuilds();

    expect(Array.isArray(builds.builds)).toBe(true);

    // 생성한 run_id가 목록에 존재해야 함
    const ourBuild = builds.builds.find((b) => b.run_id === runId);
    expect(ourBuild).toBeDefined();
    expect(ourBuild?.status).toBe("failed");
  });
});
