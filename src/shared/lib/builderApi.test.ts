/**
 * builderApi 재시도 정책 테스트 (#117).
 *
 * 비멱등 POST /build는 5xx에도 재시도하지 않아야 하며, 멱등 GET은 재시도한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { builderApi, setAuthTokenProvider, _resetAuthTokenProvider } from "./builderApi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("builderApi retry policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not retry POST /build on 5xx (#117)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(500, { error: "boom" }));

    await expect(builderApi.build("dataset_id: x")).rejects.toMatchObject({
      status: 500,
    });

    // 최초 1회만 호출되어야 한다 (재시도 없음).
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries idempotent GET /version on 5xx", async () => {
    // 실제 백오프 대기(500ms)를 기다리지 않도록 fake timer로 시간을 직접 진행시킨다.
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(jsonResponse(500, { error: "temp" }))
        .mockResolvedValueOnce(
          jsonResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }),
        );

      const pending = builderApi.version();
      // 첫 번째 재시도 전 백오프(500ms)를 즉시 소리을 통과시킨다.
      await vi.advanceTimersByTimeAsync(500);
      const result = await pending;

      expect(result.api_version).toBe("1.0.0");
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("apiFetch auth header injection (#186)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAuthTokenProvider();
  });

  afterEach(() => {
    _resetAuthTokenProvider();
    vi.restoreAllMocks();
  });

  function requestInitOf(fetchMock: ReturnType<typeof vi.spyOn>) {
    // fetch(url, init) — 두 번째 인자가 RequestInit.
    return fetchMock.mock.calls[0][1] as RequestInit;
  }

  it("does not send Authorization when no provider is set (회귀 없음)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }));

    await builderApi.version();

    const headers = requestInitOf(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    // 미로그인/mock 모드에서 빈 헤더가 나가지 않는다.
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends Authorization: Bearer <token> when provider returns a token", async () => {
    setAuthTokenProvider(() => "id-token-jwt");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }));

    await builderApi.version();

    const headers = requestInitOf(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer id-token-jwt");
  });

  it("does not send Authorization when provider returns null (미로그인)", async () => {
    setAuthTokenProvider(() => null);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }));

    await builderApi.version();

    const headers = requestInitOf(fetchMock).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
