import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiFetch,
  builderApi,
  extractErrorMessage,
} from "@/shared/lib/builderApi";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("builderApi client (#29)", () => {
  it("version() GETs /version and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.version();

    expect(result.api_version).toBe("1.0.0");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/version");
    expect(init.method).toBe("GET");
  });

  it("preview() POSTs spec to /preview (#75)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        dataset_id: "test_dataset",
        previews: [],
        api_version: "1.0.0",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await builderApi.preview("dataset_id: x");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/preview");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ spec: "dataset_id: x" });
  });

  it("build() POSTs spec + run_id as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        status: "ok",
        run_id: "run1",
        outcomes: [],
        manifest: "m.json",
        api_version: "1.0.0",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.build("dataset_id: x", "run1");

    expect(result.run_id).toBe("run1");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ spec: "dataset_id: x", run_id: "run1" });
  });

  it("throws ApiError with the server message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(400, { error: "bad spec" })));

    await expect(apiFetch("/validate", { method: "POST", body: { spec: "" } })).rejects.toMatchObject(
      { name: "ApiError", status: 400, message: "bad spec" },
    );
  });

  it("throws ApiError(0) when the network call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const error = await apiFetch("/version").catch((cause) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it("surfaces outcomes[].error on a 502 with no top-level error (#75)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(502, {
          status: "failed",
          outcomes: [{ source_key: "datago", status: "failed", error: "source 502" }],
        }),
      ),
    );

    const error = await apiFetch("/build", { method: "POST", body: { spec: "" } }).catch(
      (cause) => cause,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("source 502");
  });
});

describe("extractErrorMessage (#75)", () => {
  it("extracts the real reason from outcomes[].error (no top-level error)", () => {
    expect(
      extractErrorMessage({
        status: "failed",
        outcomes: [{ source_key: "datago", status: "failed", error: "인증 실패" }],
      }),
    ).toBe("인증 실패");
  });

  it("joins multiple outcome errors with a semicolon", () => {
    expect(
      extractErrorMessage({ outcomes: [{ error: "A" }, { error: null }, { error: "B" }] }),
    ).toBe("A; B");
  });

  it("prefers a top-level error over outcomes (backward compat)", () => {
    expect(extractErrorMessage({ error: "top", outcomes: [{ error: "ignored" }] })).toBe("top");
  });

  it("returns undefined when no structured reason is present", () => {
    expect(extractErrorMessage({ status: "failed", outcomes: [] })).toBeUndefined();
    expect(extractErrorMessage(undefined)).toBeUndefined();
    expect(extractErrorMessage("oops")).toBeUndefined();
  });
});

describe("Zod 스키마 런타임 검증 (#158, #103)", () => {
  it("version() 스키마 검증 - 올바른 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.version();

    expect(result.service).toBe("kpubdata-builder");
    expect(result.api_version).toBe("1.0.0");
  });

  it("version() 스키마 검증 - 필드 누락 시 실패", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { service: "kpubdata-builder" }), // api_version 누락
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(builderApi.version()).rejects.toThrow("응답 스키마 검증 실패");
  });

  it("validate() 스키마 검증 - valid 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        status: "valid",
        dataset_id: "test_dataset",
        api_version: "1.0.0",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.validate("dataset_id: x");

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.dataset_id).toBe("test_dataset");
    }
  });

  it("validate() 스키마 검증 - invalid 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(400, {
        status: "invalid",
        problems: ["필수 파라미터 누락"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await builderApi.validate("invalid");
      expect.fail("ApiError가 발생해야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
    }
  });

  it("build() 스키마 검증 - ok 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        status: "ok",
        run_id: "run_123",
        outcomes: [
          {
            source_key: "kma__forecast",
            status: "ok",
            stages_completed: ["bronze", "silver"],
            error: null,
          },
        ],
        manifest: "output/run_123/manifest.json",
        api_version: "1.0.0",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.build("dataset_id: x");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.run_id).toBe("run_123");
      expect(result.outcomes).toHaveLength(1);
    }
  });

  it("preview() 스키마 검증 - 올바른 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        dataset_id: "weather_report",
        previews: [
          {
            source_key: "kma__forecast",
            status: "ok",
            error: null,
            schema: [
              { name: "date", dtype: "Utf8", nullable: false, unique_count: 30 },
            ],
            sample: [{ date: "2024-04-01" }],
            total_rows: 30,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.preview("dataset_id: x");

    expect(result.dataset_id).toBe("weather_report");
    expect(result.previews).toHaveLength(1);
    expect(result.previews[0].schema).toBeDefined();
  });

  it("artifacts() 스키마 검증 - 올바른 응답 통과", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        run_id: "run_123",
        files: ["manifest.json", "data.parquet"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await builderApi.artifacts("run_123");

    expect(result.run_id).toBe("run_123");
    expect(result.files).toContain("manifest.json");
  });
});
