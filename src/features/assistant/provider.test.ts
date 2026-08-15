/**
 * LLM 오류 응답 sanitization 테스트 (#256 리뷰 §2).
 *
 * 서버가 돌려준 raw response body(내부 구현/스택/때로는 반사된 key)가 사용자-facing
 * Error message에 그대로 노출되지 않는지 확인한다. bad key / rate limit / server error
 * 각각 status만 근거로 한 고정 메시지여야 한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider, describeLlmHttpError } from "./provider";
import type { AssistMessage } from "./provider";

/** stream()이 응답 바디를 즉시 소진하는 no-op SSE 스트림 mock. */
function mockStreamResponse(): Response {
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => ({ done: true, value: undefined }),
      }),
    },
  } as unknown as Response;
}

const SENSITIVE_BODY = JSON.stringify({
  error: {
    message: "Incorrect API key provided: sk-live-secret-abc123. Internal trace: srv-7f2a at /var/app/openai/handler.js:42",
    type: "invalid_request_error",
  },
});

function mockErrorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    body: null,
  } as unknown as Response;
}

async function drain(iterable: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of iterable) out += chunk;
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeLlmHttpError (#256 리뷰 §2)", () => {
  it("returns a fixed auth message for 401/403 (bad key)", () => {
    expect(describeLlmHttpError(401)).toMatch(/API Key/);
    expect(describeLlmHttpError(403)).toMatch(/API Key/);
  });

  it("returns a fixed rate-limit message for 429", () => {
    expect(describeLlmHttpError(429)).toMatch(/rate limit|한도/);
  });

  it("returns a fixed server-error message for 5xx", () => {
    expect(describeLlmHttpError(500)).toMatch(/서버/);
    expect(describeLlmHttpError(503)).toMatch(/서버/);
  });

  it("never includes arbitrary response text — only status-derived fixed strings", () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) {
      expect(describeLlmHttpError(status)).not.toContain("sk-live-secret-abc123");
      expect(describeLlmHttpError(status)).not.toContain("Internal trace");
    }
  });
});

describe("ByokProvider.stream — HTTP error sanitization (#256 리뷰 §2)", () => {
  it("throws a sanitized message (not the raw body) on a 401 bad-key response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(401, SENSITIVE_BODY)));
    const provider = createProvider({ apiKey: "sk-live-secret-abc123", model: "gpt-4o-mini", baseUrl: "" });

    await expect(drain(provider.stream([]))).rejects.toThrow(/API Key/);
    await expect(drain(provider.stream([]))).rejects.not.toThrow(/sk-live-secret-abc123/);
  });

  it("throws a sanitized message on a 429 rate-limit response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(429, SENSITIVE_BODY)));
    const provider = createProvider({ apiKey: "sk-live-secret-abc123", model: "gpt-4o-mini", baseUrl: "" });

    await expect(drain(provider.stream([]))).rejects.toThrow(/rate limit|한도/);
  });

  it("throws a sanitized message on a 500 server-error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockErrorResponse(500, SENSITIVE_BODY)));
    const provider = createProvider({ apiKey: "sk-live-secret-abc123", model: "gpt-4o-mini", baseUrl: "" });

    await expect(drain(provider.stream([]))).rejects.toThrow(/서버/);
  });

  it("never reads/exposes the raw response body text for any error status", async () => {
    const textFn = vi.fn(async () => SENSITIVE_BODY);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: textFn, body: null } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    const provider = createProvider({ apiKey: "sk-live-secret-abc123", model: "gpt-4o-mini", baseUrl: "" });

    let caught: unknown;
    try {
      await drain(provider.stream([]));
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain("sk-live-secret-abc123");
    expect((caught as Error).message).not.toContain("Internal trace");
    // sanitization은 body를 아예 읽지 않는 방식으로 구현되어 있다 — 디버깅을 위해서도 남기지 않는다.
    expect(textFn).not.toHaveBeenCalled();
  });

  it("still redacts the API key from network-level (fetch throw) errors", async () => {
    const apiKey = "sk-live-secret-abc123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(`failed to reach host with key ${apiKey}`)),
    );
    const provider = createProvider({ apiKey, model: "gpt-4o-mini", baseUrl: "" });

    let caught: unknown;
    try {
      await drain(provider.stream([]));
    } catch (cause) {
      caught = cause;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain(apiKey);
  });
});

describe("ByokProvider.stream — fail-closed 시크릿 스크럽 (#277 리뷰)", () => {
  // scrubSecrets가 잡아내는 고엔트로피 값(길이>=24, base64풍) — src/features/assistant/scrub.test.ts와 동일한 형태.
  const HIGH_ENTROPY_SECRET = "9dF8kQ2mZ7xV3nL1pR4wY6tB0hJ5sC8gU2iE7oA9bN3cM6dP4qK1rS8tU0vW3xY5z";

  it("scrubs a raw secret value in message content even when the caller never called scrubSecrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const provider = createProvider({ apiKey: "sk-test-key", model: "gpt-4o-mini", baseUrl: "" });

    const messages: AssistMessage[] = [{ role: "user", content: HIGH_ENTROPY_SECRET }];
    await drain(provider.stream(messages));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).not.toContain(HIGH_ENTROPY_SECRET);
  });

  it("still sends a normal Kubi/assistant request body unchanged (no false-positive scrub of ordinary text)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const provider = createProvider({ apiKey: "sk-test-key", model: "gpt-4o-mini", baseUrl: "" });

    const messages: AssistMessage[] = [
      { role: "system", content: "당신은 KPubData Studio의 데이터 어시스턴트입니다." },
      { role: "user", content: "대기질 데이터셋의 최근 실행 상태를 알려줘." },
    ];
    await drain(provider.stream(messages));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual(messages);
  });

  it("keeps the API key in the Authorization header (only message content is scrub target)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse());
    vi.stubGlobal("fetch", fetchMock);
    const apiKey = "sk-test-key-abc123";
    const provider = createProvider({ apiKey, model: "gpt-4o-mini", baseUrl: "" });

    await drain(provider.stream([{ role: "user", content: HIGH_ENTROPY_SECRET }]));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${apiKey}`);
  });
});
