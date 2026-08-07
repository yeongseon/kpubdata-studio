/**
 * artifacts API 진입점 테스트 (#75).
 *
 * 실연동 모드에서 Builder `/artifacts/{run_id}`의 실제 와이어 형태({files, run_id})를
 * 페이지가 쓰는 BuildManifest로 매핑하는지, mock 모드에서는 기존 mock manifest를 그대로
 * 반환하는지 검증한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBuildManifest } from "@/features/artifacts/api";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getBuildManifest (#75)", () => {
  it("maps the real /artifacts {files, run_id} shape to a BuildManifest in real mode", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        run_id: "run-99",
        files: ["artifacts/builds/run-99/data.jsonl", "artifacts/builds/run-99/README.md"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const manifest = await getBuildManifest("run-99");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/artifacts/run-99");
    expect(manifest.build_id).toBe("run-99");
    expect(manifest.outputs).toEqual([
      "artifacts/builds/run-99/data.jsonl",
      "artifacts/builds/run-99/README.md",
    ]);
    // /artifacts가 제공하지 않는 필드는 undefined로 남겨 미제공 상태를 표현 (#119)
    expect(manifest.row_counts).toBeUndefined();
    expect(manifest.provenance).toBeUndefined();
    expect(manifest.inputs_fingerprint).toBeNull();
    expect(manifest.started_at).toBeUndefined();
    expect(manifest.finished_at).toBeUndefined();
    expect(manifest.inputs).toBeUndefined();
    expect(manifest.warnings).toBeUndefined();
    expect(manifest.errors).toBeUndefined();
    expect(manifest.schema_summaries).toBeUndefined();
  });

  it("returns the mock manifest without network in mock mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const manifest = await getBuildManifest("air-quality-20260621");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(manifest.build_id).toBe("air-quality-20260621");
    // 성공한 빌드는 row_counts가 제공됨
    expect(manifest.row_counts).toBeDefined();
    const total = Object.values(manifest.row_counts ?? {}).reduce((sum, n) => sum + n, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("returns mock manifest with undefined fields for failed builds (#119)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // 실패한 빌드에 대한 mock manifest
    const manifest = await getBuildManifest("dur-older-adult-caution-20260618");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(manifest.build_id).toBe("dur-older-adult-caution-20260618");
    // 실패한 빌드는 row_counts가 제공되지 않음 (undefined)
    expect(manifest.row_counts).toBeUndefined();
    expect(manifest.schema_summaries).toBeUndefined();
    expect(manifest.provenance).toBeUndefined();
    // errors는 제공됨
    expect(manifest.errors).toBeDefined();
    expect(manifest.errors?.length).toBeGreaterThan(0);
  });
});
