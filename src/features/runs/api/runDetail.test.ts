/**
 * #487 BuildSpec snapshot / #496 structured run events client 테스트.
 *
 * mock 모드에서는 두 표면 다 fixture가 없다 — "있는 척" 값을 지어내는 대신
 * 명시적으로 지원되지 않는다고 던지는지 확인한다(#255 §12 원칙).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { builderApi } from "@/shared/lib/builderApi";
import { getBuildEvents, getBuildSpecSnapshot, MockUnsupportedError } from "./runDetail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getBuildSpecSnapshot / getBuildEvents (#255)", () => {
  it("throws MockUnsupportedError instead of fabricating data when Builder is not wired up", async () => {
    await expect(getBuildSpecSnapshot("run-1")).rejects.toBeInstanceOf(MockUnsupportedError);
    await expect(getBuildEvents("run-1")).rejects.toBeInstanceOf(MockUnsupportedError);
  });

  it("delegates to builderApi in real mode without altering the response", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const specSpy = vi
      .spyOn(builderApi, "getBuildSpecSnapshot")
      .mockResolvedValue({ run_id: "run-1", spec: "dataset_id: x\n", spec_digest: `sha256:${"0".repeat(64)}` });
    const eventsSpy = vi.spyOn(builderApi, "getBuildEvents").mockResolvedValue({ run_id: "run-1", events: [] });

    await expect(getBuildSpecSnapshot("run-1")).resolves.toMatchObject({ run_id: "run-1" });
    await expect(getBuildEvents("run-1", { limit: 10 })).resolves.toEqual({ run_id: "run-1", events: [] });
    expect(specSpy).toHaveBeenCalledWith("run-1", undefined);
    expect(eventsSpy).toHaveBeenCalledWith("run-1", { limit: 10 }, undefined);
  });
});
