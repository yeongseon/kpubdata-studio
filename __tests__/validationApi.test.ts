import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSpec } from "@/features/validation/api";
import type { BuildSpec } from "@/shared/lib/types";

const spec: BuildSpec = {
  datasetId: "x",
  title: "t",
  description: "d",
  sources: [{ provider: "datago", dataset: "air", params: {} }],
  exports: [{ format: "jsonl" }],
  metadata: {},
};

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

describe("validateSpec wiring (#29/#37)", () => {
  it("returns valid without calling the network in mock mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateSpec(spec);

    expect(result).toEqual({ valid: true, errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Builder /validate and returns valid when real mode is on", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, { status: "valid", dataset_id: "x", api_version: "1.0.0" }),
      ),
    );

    const result = await validateSpec(spec);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("maps a 400 invalid response to valid=false with problems", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(400, { status: "invalid", problems: ["제목을 입력해주세요."] }),
      ),
    );

    const result = await validateSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["제목을 입력해주세요."]);
  });
});
