/**
 * `/query` 결과 row 값 표시 regression test (#256 리뷰 §1).
 *
 * array/object 값이 `String(value)`를 거쳐 "[object Object]"로 뭉개지지 않고, 실제 JSON
 * 내용이 보이는지 확인한다. null/primitive는 기존 표시 방식을 그대로 유지해야 한다.
 */
import { describe, expect, it } from "vitest";
import { formatQueryValue } from "./KubiContent";

describe("formatQueryValue (#256 리뷰 §1)", () => {
  it("shows a dash for null/undefined, matching the previous behavior", () => {
    expect(formatQueryValue(null)).toBe("—");
    expect(formatQueryValue(undefined)).toBe("—");
  });

  it("shows primitives as plain text, matching the previous behavior", () => {
    expect(formatQueryValue("서울")).toBe("서울");
    expect(formatQueryValue(42)).toBe("42");
    expect(formatQueryValue(0)).toBe("0");
    expect(formatQueryValue(true)).toBe("true");
    expect(formatQueryValue(false)).toBe("false");
  });

  it("renders an array as its actual JSON content, not [object Object]", () => {
    expect(formatQueryValue([1, 2, 3])).toBe("[1,2,3]");
    expect(formatQueryValue(["서울", "부산"])).toBe(JSON.stringify(["서울", "부산"]));
  });

  it("renders a plain object as its actual JSON content, not [object Object]", () => {
    const value = { region: "서울", count: 12 };
    expect(formatQueryValue(value)).toBe(JSON.stringify(value));
    expect(formatQueryValue(value)).not.toBe("[object Object]");
  });

  it("renders nested array/object values without collapsing them", () => {
    const value = { tags: ["a", "b"], meta: { ok: true } };
    expect(formatQueryValue(value)).toBe(JSON.stringify(value));
  });

  it("renders an empty array/object distinctly from null", () => {
    expect(formatQueryValue([])).toBe("[]");
    expect(formatQueryValue({})).toBe("{}");
  });
});
