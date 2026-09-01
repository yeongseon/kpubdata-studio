import { describe, expect, it } from "vitest";
import { getSafeReturnTo } from "./returnTo";

describe("getSafeReturnTo", () => {
  it("keeps an internal path including its query", () => {
    expect(getSafeReturnTo("/builds?run=abc")).toBe("/builds?run=abc");
  });

  it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example/path", undefined])(
    "falls back for an unsafe returnTo",
    (value) => expect(getSafeReturnTo(value)).toBe("/"),
  );
});
