import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeBuild } from "@/features/runs/api";
import { useBuildJob } from "@/features/runs/useBuildJob";
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

describe("executeBuild (#39)", () => {
  it("returns a mock succeeded run without network in mock mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const run = await executeBuild(spec);
    expect(run.status).toBe("succeeded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Builder /build in real mode and maps ok→succeeded", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          status: "ok",
          run_id: "run42",
          outcomes: [],
          manifest: "m",
          api_version: "1.0.0",
        }),
      ),
    );
    const run = await executeBuild(spec);
    expect(run.id).toBe("run42");
    expect(run.status).toBe("succeeded");
  });
});

describe("useBuildJob (#39)", () => {
  it("transitions idle → running → succeeded", async () => {
    const { result } = renderHook(() => useBuildJob());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.start(spec);
    });

    expect(result.current.status).toBe("succeeded");
    expect(result.current.run?.id).toBe("mock-run");
  });

  it("marks the job failed when the build errors (real mode, 502)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(502, { error: "upstream source failed" })),
    );

    const { result } = renderHook(() => useBuildJob());
    await act(async () => {
      await result.current.start(spec);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toContain("upstream source failed");
  });
});
