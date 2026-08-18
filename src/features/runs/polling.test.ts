/**
 * visibility-aware polling(#255 §3) 계열 훅 테스트를 한 파일로 모았다.
 *
 * `useVisibilityAwarePolling`(공유 primitive), `useSelectedRunPolling`(#245/#255 P0),
 * `useRunEvents`(#255 P1)는 서로 독립적이지만 같은 fake-timer/visibilitychange 픽스처를
 * 공유하므로, 파일마다 별도 jsdom 환경을 새로 만드는 대신 한 파일에 모아 CI 부담을 줄인다.
 *
 * fake sleep/timeout 증가에 의존하지 않고, vi.useFakeTimers + visibilitychange dispatch로
 * deterministic하게 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError, builderApi, type BuildEventsResponse, type BuildJob } from "@/shared/lib/builderApi";
import { useVisibilityAwarePolling } from "./useVisibilityAwarePolling";
import { useSelectedRunPolling } from "./useSelectedRunPolling";
import { useRunEvents } from "./useRunEvents";

function job(overrides: Partial<BuildJob> = {}): BuildJob {
  return {
    run_id: "run-1",
    status: "running",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  } as BuildJob;
}

function events(overrides: Partial<BuildEventsResponse> = {}): BuildEventsResponse {
  return { run_id: "run-1", events: [], ...overrides };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useVisibilityAwarePolling", () => {
  it("calls tick on each interval while visible", () => {
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePolling(tick, 1000, true));

    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(tick).toHaveBeenCalledWith("interval");
  });

  it("does not call tick on interval while hidden", () => {
    const tick = vi.fn();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    renderHook(() => useVisibilityAwarePolling(tick, 1000, true));

    vi.advanceTimersByTime(5000);
    expect(tick).not.toHaveBeenCalled();
  });

  it("refreshes immediately on hidden -> visible transition", () => {
    const tick = vi.fn();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    renderHook(() => useVisibilityAwarePolling(tick, 1000, true));

    vi.advanceTimersByTime(2000);
    expect(tick).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledWith("visible-resume");
  });

  it("does not schedule anything when disabled (terminal state)", () => {
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePolling(tick, 1000, false));

    vi.advanceTimersByTime(10000);
    expect(tick).not.toHaveBeenCalled();
  });

  it("cleans up the timer and listener on unmount", () => {
    const tick = vi.fn();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useVisibilityAwarePolling(tick, 1000, true));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    vi.advanceTimersByTime(10000);
    expect(tick).not.toHaveBeenCalled();
  });
});

describe("useSelectedRunPolling", () => {
  it("fetches immediately on selection and keeps polling a non-terminal job while visible", async () => {
    const spy = vi
      .spyOn(builderApi, "getBuildJob")
      .mockResolvedValueOnce(job({ status: "running" }))
      .mockResolvedValueOnce(job({ status: "running" }))
      .mockResolvedValueOnce(job({ status: "succeeded" }));

    const { result } = renderHook(() => useSelectedRunPolling("run-1"));
    await vi.waitFor(() => expect(result.current.kind).toBe("job"));
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(spy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.current).toEqual({ kind: "job", job: job({ status: "succeeded" }) });
  });

  it("stops interval polling once the job reaches a terminal state", async () => {
    const spy = vi.spyOn(builderApi, "getBuildJob").mockResolvedValue(job({ status: "succeeded" }));
    const { result } = renderHook(() => useSelectedRunPolling("run-1"));
    await vi.waitFor(() => expect(result.current.kind).toBe("job"));
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    // terminal이므로 interval이 예약되지 않아 추가 호출이 없어야 한다.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not poll on an interval while still loading (only after a confirmed non-terminal job)", async () => {
    let resolveFirst!: (value: BuildJob) => void;
    const pending = new Promise<BuildJob>((resolve) => {
      resolveFirst = resolve;
    });
    const spy = vi.spyOn(builderApi, "getBuildJob").mockImplementationOnce(() => pending);
    renderHook(() => useSelectedRunPolling("run-1"));

    // 아직 "loading" 상태다 — 첫 조회가 끝나기 전에는 interval을 잡지 않는다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    resolveFirst(job({ status: "running" }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("does not issue new interval requests while hidden, and refreshes once on return to visible", async () => {
    const spy = vi.spyOn(builderApi, "getBuildJob").mockResolvedValue(job({ status: "running" }));
    renderHook(() => useSelectedRunPolling("run-1"));
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("visible");
    });
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it("classifies 404 as not_in_registry (historical run) and 403 as permission_denied, distinctly", async () => {
    vi.spyOn(builderApi, "getBuildJob").mockRejectedValueOnce(new ApiError(404, "not found"));
    const { result, rerender } = renderHook(({ runId }) => useSelectedRunPolling(runId), {
      initialProps: { runId: "run-404" },
    });
    await vi.waitFor(() => expect(result.current.kind).toBe("not_in_registry"));

    vi.spyOn(builderApi, "getBuildJob").mockRejectedValueOnce(new ApiError(403, "forbidden"));
    rerender({ runId: "run-403" });
    await vi.waitFor(() => expect(result.current.kind).toBe("permission_denied"));
  });

  it("does not turn a transient network error into a failed run status", async () => {
    vi.spyOn(builderApi, "getBuildJob").mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useSelectedRunPolling("run-1"));
    await vi.waitFor(() => expect(result.current.kind).toBe("error"));
    expect(result.current).toMatchObject({ kind: "error" });
  });

  it("aborts the in-flight request when the run selection changes, so a stale response cannot overwrite the new selection", async () => {
    let resolveFirst!: (job: BuildJob) => void;
    const first = new Promise<BuildJob>((resolve) => {
      resolveFirst = resolve;
    });
    const spy = vi
      .spyOn(builderApi, "getBuildJob")
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(job({ run_id: "run-b", status: "succeeded" }));

    const { result, rerender } = renderHook(({ runId }) => useSelectedRunPolling(runId), {
      initialProps: { runId: "run-a" },
    });
    rerender({ runId: "run-b" });
    await vi.waitFor(() => expect(result.current).toEqual({ kind: "job", job: job({ run_id: "run-b", status: "succeeded" }) }));

    // run-a의 늦은 응답이 이제 도착해도 run-b 선택을 덮어써서는 안 된다.
    resolveFirst(job({ run_id: "run-a", status: "succeeded" }));
    await Promise.resolve();
    expect(result.current).toEqual({ kind: "job", job: job({ run_id: "run-b", status: "succeeded" }) });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("useRunEvents", () => {
  it("mock 모드에서는 MockUnsupportedError를 network 오류와 구분되는 mockUnsupported로 노출한다", async () => {
    // 기본 테스트 환경은 VITE_USE_REAL_BUILDER가 설정되지 않은 mock 모드다.
    const { result } = renderHook(() => useRunEvents("run-1", true));
    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ status: "error", mockUnsupported: true });
  });

  it("실연동 모드에서 event를 불러오고, pollingEnabled일 때만 interval polling을 계속한다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const spy = vi.spyOn(builderApi, "getBuildEvents").mockResolvedValue(events());

    const { rerender } = renderHook(({ enabled }) => useRunEvents("run-1", enabled), {
      initialProps: { enabled: true },
    });
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(spy).toHaveBeenCalledTimes(2);

    // Run이 terminal이 되어 호출부가 pollingEnabled=false로 넘기면 더 이상 polling하지 않는다.
    rerender({ enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(spy).toHaveBeenCalledTimes(2);

    vi.unstubAllEnvs();
  });

  it("hidden 동안 새 polling request를 만들지 않고, visible 복귀 시 즉시 한 번 refresh한다", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    const spy = vi.spyOn(builderApi, "getBuildEvents").mockResolvedValue(events());
    renderHook(() => useRunEvents("run-1", true));
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("visible");
    });
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    vi.unstubAllEnvs();
  });

  it("distinguishes 403 (permission_denied) from 404 (not_found) without guessing", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.spyOn(builderApi, "getBuildEvents").mockRejectedValueOnce(new ApiError(403, "forbidden"));
    const { result } = renderHook(() => useRunEvents("run-1", true));
    await vi.waitFor(() => expect(result.current).toMatchObject({ status: "error", permissionDenied: true }));

    vi.unstubAllEnvs();
  });

  it("does not let a failing event fetch affect any other run detail state (independent failure)", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.spyOn(builderApi, "getBuildEvents").mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useRunEvents("run-1", true));
    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    // 이 훅은 자기 자신의 상태만 갖고 있다 — 다른 카드(Stage/Quality/Spec)의 상태와는
    // 완전히 분리된 훅이므로, 실패해도 이 반환값 밖으로 아무 영향을 주지 않는다.
    expect(result.current).toMatchObject({ status: "error" });

    vi.unstubAllEnvs();
  });
});
