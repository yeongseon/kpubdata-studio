import { afterEach, describe, expect, it, vi } from "vitest";

import { createProvider } from "./provider";

afterEach(() => {
  vi.unstubAllGlobals();
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
    const chunks: string[] = [];
    for await (const chunk of provider.stream([
      { role: "user", content: `분석 ${textSecret}` },
      {
        role: "system",
        content: "현재 스펙",
        structuredContent: { sources: [{ params: { serviceKey: structuredSecret } }] },
      },
    ])) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("ok");
    expect(requestBody).not.toContain(textSecret);
    expect(requestBody).not.toContain(structuredSecret);
    expect(requestBody).toContain("__SCRUBBED_");
  });

  it("일반 chat 응답에는 시크릿이나 플레이스홀더를 노출하지 않는다", async () => {
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
    let output = "";
    for await (const chunk of provider.stream([
      { role: "user", content: "분석", structuredContent: { serviceKey: secret } },
    ])) {
      output += chunk;
    }

    expect(output).toBe("[REDACTED]");
    expect(output).not.toContain(secret);
  });
});
