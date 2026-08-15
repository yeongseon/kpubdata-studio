import { afterEach, describe, expect, it, vi } from "vitest";

import { createProvider, describeLlmHttpError } from "./provider";

const SENSITIVE_BODY = JSON.stringify({
  error: {
    message:
      "Incorrect API key provided: sk-live-secret-abc123. Internal trace: srv-7f2a at /var/app/openai/handler.js:42",
  },
});

function mockErrorResponse(status: number): Response {
  return { ok: false, status, body: null } as unknown as Response;
}

async function drain(iterable: AsyncIterable<string>): Promise<string> {
  let output = "";
  for await (const chunk of iterable) output += chunk;
  return output;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeLlmHttpError (#256)", () => {
  it("HTTP status만 사용한 고정 메시지를 반환한다", () => {
    expect(describeLlmHttpError(401)).toMatch(/API Key/);
    expect(describeLlmHttpError(403)).toMatch(/API Key/);
    expect(describeLlmHttpError(429)).toMatch(/rate limit|한도/);
    expect(describeLlmHttpError(500)).toMatch(/서버/);
    expect(describeLlmHttpError(503)).toMatch(/서버/);
  });

  it("임의의 response text를 포함하지 않는다", () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) {
      expect(describeLlmHttpError(status)).not.toContain("sk-live-secret-abc123");
      expect(describeLlmHttpError(status)).not.toContain("Internal trace");
    }
  });
});

describe("assistant provider error sanitization (#256)", () => {
  it.each([
    [401, /API Key/],
    [429, /rate limit|한도/],
    [500, /서버/],
  ])("%i 응답의 raw body를 노출하지 않는다", async (status, expected) => {
    const text = vi.fn(async () => SENSITIVE_BODY);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ...mockErrorResponse(status), text }),
    );
    const provider = createProvider({
      apiKey: "sk-live-secret-abc123",
      model: "gpt-4o-mini",
      baseUrl: "",
    });

    await expect(drain(provider.stream([]))).rejects.toThrow(expected);
    await expect(drain(provider.stream([]))).rejects.not.toThrow("sk-live-secret-abc123");
    expect(text).not.toHaveBeenCalled();
  });

  it("network error에 반사된 API key를 제거한다", async () => {
    const apiKey = "sk-live-secret-abc123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(`failed to reach host with key ${apiKey}`)),
    );
    const provider = createProvider({ apiKey, model: "gpt-4o-mini", baseUrl: "" });

    let caught: unknown;
    try {
      await drain(provider.stream([]));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain(apiKey);
  });
});

describe("assistant safe egress (#273)", () => {
  it("최종 HTTP body에서 text와 structured content의 시크릿을 제거한다", async () => {
    const textSecret = "xJ7kL9mN2pQ4rT6vW8yB3cD5eF7gH9j";
    const structuredSecret = "low-entropy-key";
    let requestBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = String(init?.body);
        return new Response(
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
          { status: 200 },
        );
      }),
    );

    const provider = createProvider({
      apiKey: "byok-key",
      model: "test-model",
      baseUrl: "https://llm.example.com/v1",
    });
    const output = await drain(
      provider.stream([
        { role: "user", content: `분석 ${textSecret}` },
        {
          role: "system",
          content: "현재 스펙",
          structuredContent: { sources: [{ params: { serviceKey: structuredSecret } }] },
        },
      ]),
    );

    expect(output).toBe("ok");
    expect(requestBody).not.toContain(textSecret);
    expect(requestBody).not.toContain(structuredSecret);
    expect(requestBody).toContain("__SCRUBBED_");
  });

  it("일반 응답에는 시크릿이나 플레이스홀더를 노출하지 않는다", async () => {
    const secret = "low-entropy-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          'data: {"choices":[{"delta":{"content":"__SCRUB"}}]}\n\n' +
            'data: {"choices":[{"delta":{"content":"BED_fake_0__"}}]}\n\n',
          { status: 200 },
        ),
      ),
    );

    const provider = createProvider({
      apiKey: "byok-key",
      model: "test-model",
      baseUrl: "https://llm.example.com/v1",
    });
    const output = await drain(
      provider.stream([
        { role: "user", content: "분석", structuredContent: { serviceKey: secret } },
      ]),
    );

    expect(output).toBe("[REDACTED]");
    expect(output).not.toContain(secret);
  });
});
