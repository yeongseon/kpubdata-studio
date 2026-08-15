import { describe, expect, it } from "vitest";
import { checkLlmBaseUrl, DEFAULT_LLM_BASE_URL, redactApiKey } from "./baseUrl";

describe("checkLlmBaseUrl (#256 리뷰 §2)", () => {
  it("treats an empty input as the safe default", () => {
    const result = checkLlmBaseUrl("");
    expect(result.safe).toBe(true);
    expect(result.isDefault).toBe(true);
    expect(result.resolvedUrl).toBe(DEFAULT_LLM_BASE_URL);
  });

  it("accepts the default URL and marks it as default", () => {
    const result = checkLlmBaseUrl(DEFAULT_LLM_BASE_URL);
    expect(result.safe).toBe(true);
    expect(result.isDefault).toBe(true);
  });

  it("accepts a different HTTPS URL but flags it as non-default", () => {
    const result = checkLlmBaseUrl("https://my-proxy.example.com/v1");
    expect(result.safe).toBe(true);
    expect(result.isDefault).toBe(false);
  });

  it("rejects http:// (key exfiltration risk)", () => {
    const result = checkLlmBaseUrl("http://insecure.example.com/v1");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/HTTPS/);
  });

  it("rejects a malformed URL", () => {
    const result = checkLlmBaseUrl("not a url");
    expect(result.safe).toBe(false);
  });

  it("rejects a non-http(s) scheme", () => {
    const result = checkLlmBaseUrl("javascript:alert(1)");
    expect(result.safe).toBe(false);
  });
});

describe("redactApiKey", () => {
  it("replaces every occurrence of the key with a placeholder", () => {
    const text = "error calling sk-secret-123: sk-secret-123 is invalid";
    expect(redactApiKey(text, "sk-secret-123")).toBe("error calling [REDACTED]: [REDACTED] is invalid");
  });

  it("returns text unchanged when there is no key", () => {
    expect(redactApiKey("plain error", "")).toBe("plain error");
  });

  it("leaves text without the key untouched", () => {
    expect(redactApiKey("unrelated error", "sk-abc")).toBe("unrelated error");
  });
});
