import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCatalog, testProvider, uploadSourceFile } from "./api";

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

describe("fetchCatalog", () => {
  it("mock 모드에서는 네트워크 없이 결정적 목업을 반환한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCatalog();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.providers.length).toBeGreaterThan(0);
  });

  it("real 모드에서는 Builder /catalog를 호출한다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        providers: [
          {
            name: "datago",
            datasets: [
              {
                name: "air_quality",
                title: "대기오염",
                description: null,
                tags: [],
                source_url: null,
                representation: "api_json",
                operations: [],
                query_support: null,
                requires_service_key: true,
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCatalog();

    expect(String(fetchMock.mock.calls[0][0])).toContain("/catalog");
    expect(result.providers[0]?.name).toBe("datago");
  });
});

describe("testProvider", () => {
  it("mock 모드에서는 항상 connected를 반환한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await testProvider("datago");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("connected");
  });

  it("real 모드에서는 POST /providers/{provider}/test를 호출하고 not_configured를 그대로 전달한다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        provider: "datago",
        status: "not_configured",
        configured: false,
        latency_ms: 0,
        checked_at: "2026-08-17T00:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testProvider("datago");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/providers/datago/test");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(result.status).toBe("not_configured");
    expect(result.configured).toBe(false);
  });
});

describe("uploadSourceFile", () => {
  it("mock 모드에서는 파일 content를 읽지 않고 결정적 upload_id를 반환한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["a,b\n1,2\n"], "data.csv", { type: "text/csv" });

    const result = await uploadSourceFile(file, "csv");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.upload_id).toMatch(/^upl_[a-f0-9]{32}$/);
    expect(result.original_filename).toBe("data.csv");
  });

  it("real 모드에서는 raw body로 POST /uploads를 호출한다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        upload_id: "upl_0123456789abcdef0123456789abcdef",
        format: "csv",
        encoding: "utf-8",
        size_bytes: 8,
        original_filename: "data.csv",
        created_at: "2026-08-17T00:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["a,b\n1,2\n"], "data.csv", { type: "text/csv" });

    const result = await uploadSourceFile(file, "csv");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/uploads?");
    expect(String(url)).toContain("format=csv");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/octet-stream");
    expect(result.upload_id).toBe("upl_0123456789abcdef0123456789abcdef");
  });
});
