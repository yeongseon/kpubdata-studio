/**
 * 어시스턴트 결정적 테스트 (ST-A9, #212).
 *
 * LLM 호출은 목으로 대체 — CI가 외부 LLM API에 의존하지 않는다.
 * 리페어 루프, 게이트 거부, 스크러빙을 고정된 응답 시퀀스로 검증한다.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/builderApi", () => ({
  isRealBuilderEnabled: () => true,
}));

import { generateBuildSpec } from "@/features/assistant/generate";
import type { AssistProvider, AssistMessage } from "@/features/assistant/provider";
import { scrubSecrets, restoreSecrets, isSecretKey, looksLikeSecret } from "@/features/assistant/scrub";

function mockProvider(responses: string[]): AssistProvider {
  let idx = 0;
  return {
    isConfigured: true,
    async *stream(_messages: AssistMessage[]): AsyncIterable<string> {
      const resp = responses[idx++] ?? responses[responses.length - 1];
      for (const char of resp) {
        yield char;
      }
    },
  };
}

describe("generateBuildSpec (ST-A7, #210)", () => {
  it("returns valid spec when validate passes on first try", async () => {
    const yaml = "dataset_id: test\ntitle: Test\ndescription: desc\nsources:\n  - key: s\n    provider: datago\n    dataset: village_fcst\nexports:\n  - kind: markdown\n    output_path: out.md\n";
    const provider = mockProvider([yaml]);
    const validateFn = vi.fn().mockResolvedValue({ valid: true });

    const result = await generateBuildSpec(provider, "weather data", {
      validateFn,
      catalogContext: "datago: village_fcst",
    });

    expect(result.status).toBe("ok");
    expect(result.spec).toContain("dataset_id: test");
    expect(result.attempts).toBe(1);
    expect(validateFn).toHaveBeenCalledTimes(1);
  });

  it("retries when validate fails, succeeds on second attempt", async () => {
    const badYaml = "invalid";
    const goodYaml = "dataset_id: test\ntitle: Test\ndescription: desc\n";
    const provider = mockProvider([badYaml, goodYaml]);
    const validateFn = vi
      .fn()
      .mockResolvedValueOnce({ valid: false, problems: ["dataset_id is empty"] })
      .mockResolvedValueOnce({ valid: true });

    const result = await generateBuildSpec(provider, "test", { validateFn });

    expect(result.status).toBe("ok");
    expect(result.attempts).toBe(2);
  });

  it("returns partial after max retries exhausted", async () => {
    const provider = mockProvider(["bad1", "bad2", "bad3"]);
    const validateFn = vi
      .fn()
      .mockResolvedValue({ valid: false, problems: ["always fails"] });

    const result = await generateBuildSpec(provider, "test", { validateFn });

    expect(result.status).toBe("partial");
    expect(result.attempts).toBe(3);
    expect(result.remaining_problems).toContain("always fails");
  });

  it("rejects generation in mock mode", async () => {
    const provider = mockProvider(["should not be called"]);
    const result = await generateBuildSpec(provider, "test", {
      validateFn: vi.fn().mockResolvedValue({ valid: true }),
    });

    expect(result.status).toBe("error");
    expect(result.spec).toBeNull();
    expect(result.remaining_problems[0]).toContain("mock");
  });
});

describe("scrubSecrets (ST-A3, #206)", () => {
  it("masks known secret key patterns", () => {
    const data = {
      serviceKey: "abc123secretkey",
      query: "station",
      apiKey: "sk-xxxxx",
      normal_param: "value",
    };
    const { scrubbed, placeholders } = scrubSecrets(data);
    const obj = scrubbed as Record<string, unknown>;

    expect(obj.serviceKey).toMatch(/__SCRUBBED_/);
    expect(obj.apiKey).toMatch(/__SCRUBBED_/);
    expect(obj.query).toBe("station");
    expect(obj.normal_param).toBe("value");
    expect(placeholders.size).toBe(2);
  });

  it("restores secrets after scrubbing", () => {
    const original = { serviceKey: "my-secret", name: "test" };
    const { scrubbed, placeholders } = scrubSecrets(original);
    const restored = restoreSecrets(scrubbed, placeholders) as Record<string, unknown>;

    expect(restored.serviceKey).toBe("my-secret");
    expect(restored.name).toBe("test");
  });

  it("detects high-entropy strings", () => {
    expect(looksLikeSecret("xJ7$kL9#mN2pQ4rT6")).toBe(true);
    expect(looksLikeSecret("short")).toBe(false);
    expect(looksLikeSecret("normal description text")).toBe(false);
  });

  it("detects secret key names", () => {
    expect(isSecretKey("serviceKey")).toBe(true);
    expect(isSecretKey("api_key")).toBe(true);
    expect(isSecretKey("auth_token")).toBe(true);
    expect(isSecretKey("client_secret")).toBe(true);
    expect(isSecretKey("query")).toBe(false);
    expect(isSecretKey("base_date")).toBe(false);
  });
});
