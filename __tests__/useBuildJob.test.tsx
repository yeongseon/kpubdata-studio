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
    // 실연동 모드는 1970 고정값이 아니라 실제 실행 시각을 기록한다.
    expect(run.startedAt).not.toBe("1970-01-01T00:00:00.000Z");
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

  it("surfaces the per-source reason from outcomes[].error on a real 502 (#75)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    // 실제 builder /build 502 와이어 형태: 최상위 error 없음, outcomes[].error에 사유.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(502, {
          status: "failed",
          run_id: "run-fail",
          manifest: "",
          api_version: "1.0.0",
          outcomes: [
            { source_key: "datago:air", status: "failed", error: "upstream source failed" },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useBuildJob());
    await act(async () => {
      await result.current.start(spec);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("upstream source failed");
  });

  it("prefers a top-level error over outcomes when present (backward compat, #75)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(502, {
          status: "failed",
          error: "top-level build error",
          outcomes: [{ source_key: "datago:air", status: "failed", error: "ignored reason" }],
        }),
      ),
    );

    const { result } = renderHook(() => useBuildJob());
    await act(async () => {
      await result.current.start(spec);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("top-level build error");
  });
});
