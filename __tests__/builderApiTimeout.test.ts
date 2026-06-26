/**
 * apiFetch 타임아웃/재시도 동작 테스트 (#94).
 *
 * Builder 응답 지연 시 UI가 무한 대기에 빠지지 않도록 자동 타임아웃이 걸리는지, 네트워크
 * 일시 장애와 5xx에 제한 재시도(지수 백오프)가 동작하는지, 호출자 취소는 즉시 전파되는지 검증한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/shared/lib/builderApi";

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function serverError(): Response {
  return {
    ok: false,
    status: 503,
    text: async () => JSON.stringify({ error: "unavailable" }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiFetch retry (#94)", () => {
  it("retries on a network error and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(okResponse({ service: "kpubdata-builder" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ service: string }>("/version", { retries: 1, timeoutMs: 0 });

    expect(result.service).toBe("kpubdata-builder");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a 5xx response and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(serverError())
      .mockResolvedValueOnce(okResponse({ service: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ service: string }>("/version", { retries: 1, timeoutMs: 0 });

    expect(result.service).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a 4xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: "bad spec" }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/validate", { retries: 2, timeoutMs: 0 })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on persistent network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiFetch("/version", { retries: 1, timeoutMs: 0 }).catch((cause) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a 408 ApiError when the request times out with no retries left", async () => {
    // fetch가 결합된 timeout signal에서 abort되면 TimeoutError로 거부한다.
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiFetch("/build", { method: "POST", timeoutMs: 5, retries: 0 }).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(408);
  });

  it("propagates caller cancellation without retrying", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = apiFetch("/version", { signal: controller.signal, retries: 2, timeoutMs: 0 });
    controller.abort(new DOMException("Aborted", "AbortError"));

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
