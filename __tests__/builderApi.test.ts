import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, builderApi } from "@/shared/lib/builderApi";

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
});
