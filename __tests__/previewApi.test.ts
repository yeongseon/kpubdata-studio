/**
 * preview API 진입점 테스트 (#93).
 *
 * 실연동 모드에서 Builder `/preview`의 실제 와이어 형태({dataset_id, previews})를 UI가 쓰는
 * {rows, schema}로 변환하는지, mock 모드에서는 네트워크 없이 결정적 mock 데이터를 반환하는지 검증한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { previewBuild } from "@/features/preview/api";
import type { BuildSpec } from "@/shared/lib/types";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const SPEC: BuildSpec = {
  datasetId: "air-quality",
  title: "대기오염 정보",
  description: "테스트",
  sources: [{ provider: "datago", dataset: "air-quality", params: {} }],
  exports: [{ format: "jsonl" }],
  metadata: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("previewBuild (#93)", () => {
  it("calls Builder /preview and maps the {dataset_id, previews} shape to {rows, schema} in real mode", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        dataset_id: "air-quality",
        previews: [
          {
            source_key: "datago.air-quality",
            status: "ok",
            error: null,
            schema: [
              { name: "region", dtype: "string", nullable: false, unique_count: 3 },
              { name: "value", dtype: "int64", nullable: true, unique_count: 3 },
            ],
            sample: [
              { region: "서울", value: 42 },
              { region: "부산", value: 37 },
            ],
            total_rows: 2,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await previewBuild(SPEC);

    expect(String(fetchMock.mock.calls[0][0])).toContain("/preview");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(result.schema).toEqual({ region: "string", value: "int64" });
    expect(result.rows).toEqual([
      { region: "서울", value: 42 },
      { region: "부산", value: 37 },
    ]);
  });

  it("prefers the first ok source when multiple previews are returned", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          dataset_id: "multi",
          previews: [
            { source_key: "a", status: "failed", error: "boom", schema: [], sample: [], total_rows: 0 },
            {
              source_key: "b",
              status: "ok",
              error: null,
              schema: [{ name: "id", dtype: "string", nullable: false, unique_count: 1 }],
              sample: [{ id: "x" }],
              total_rows: 1,
            },
          ],
        }),
      ),
    );

    const result = await previewBuild(SPEC);

    expect(result.schema).toEqual({ id: "string" });
    expect(result.rows).toEqual([{ id: "x" }]);
  });

  it("returns deterministic mock data without network in mock mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await previewBuild(SPEC);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rows.length).toBeGreaterThan(0);
    expect(Object.keys(result.schema).length).toBeGreaterThan(0);
  });
});
