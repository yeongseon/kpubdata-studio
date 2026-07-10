/**
 * builderApi 재시도 정책 테스트 (#117).
 *
 * 비멱등 POST /build는 5xx에도 재시도하지 않아야 하며, 멱등 GET은 재시도한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { builderApi } from "./builderApi";

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
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(500, { error: "temp" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { service: "kpubdata-builder", api_version: "1.0.0" }),
      );

    const result = await builderApi.version();

    expect(result.api_version).toBe("1.0.0");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
