/**
 * 비동기 build job 폴링 회귀 테스트 (#245).
 *
 * Builder async 표면(POST /builds + GET /builds/{run_id}, builder #480/#482)을
 * MSW 모의 시퀀스(queued → running → terminal)로 검증한다 — 실연동
 * executeBuild가 잡을 제출·폴링해 terminal 상태를 BuildRun으로 매핑하고,
 * useBuildJob이 Builder 잡의 wire 상태를 노출하며, 취소(로컬 abort)가
 * polling을 즉시 종료하는지 확인한다.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBuild, type BuilderJobStatus } from "@/features/runs/api";
import { useBuildJob } from "@/features/runs/useBuildJob";
import type { BuildSpec } from "@/shared/lib/types";

function specOf(datasetId: string): BuildSpec {
  return {
    datasetId,
    title: datasetId,
    description: "test spec",
    sources: [{ provider: "datago", dataset: "air_quality" }],
    exports: [],
  } as unknown as BuildSpec;
}

beforeEach(() => {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("async build job polling (#245)", () => {
  it("submits, polls through queued/running, and maps terminal success", async () => {
    const observed: BuilderJobStatus[] = [];

    const run = await executeBuild(specOf("success"), undefined, (status) =>
      observed.push(status),
    );

    expect(run.status).toBe("succeeded");
    expect(run.id.startsWith("success-")).toBe(true);
    expect(observed[0]).toBe("queued");
    expect(observed).toContain("running");
    expect(observed[observed.length - 1]).toBe("succeeded");
  });

  it("maps a failed terminal job to a failed run with the job error", async () => {
    const run = await executeBuild(specOf("fail_source"));

    expect(run.status).toBe("failed");
    expect(run.error).toBe("upstream API timeout");
  });

  it("exposes builder job status through useBuildJob and cancels polling locally", async () => {
    const { result } = renderHook(() => useBuildJob());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.start(specOf("success"));
    });
    await waitFor(() => expect(result.current.status).toBe("running"));
    await waitFor(() => expect(result.current.builderStatus).toBe("queued"));

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await promise.catch(() => undefined);
    });
    expect(result.current.status).toBe("cancelled");
  });
});
