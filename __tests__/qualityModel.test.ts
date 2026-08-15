import { describe, expect, it } from "vitest";
import {
  flattenQualityResults,
  flattenSchemaDrift,
  formatQualityValue,
  groupByCategory,
  isDuplicateCategory,
  isMissingCategory,
  isSchemaCategory,
  overallQualityState,
  summarizeByCategory,
  summarizeChecksPassed,
  warnOrFailResults,
} from "@/features/quality/model";
import type { BuildQualityResponse, QualityCheckResult } from "@/shared/lib/builderApi";

function check(overrides: Partial<QualityCheckResult>): QualityCheckResult {
  return {
    source_key: "src",
    category: "missing",
    rule: "max_null_ratio",
    column: "col",
    status: "pass",
    actual: 0,
    threshold: 0.05,
    affected_rows: 0,
    evaluated_rows: 100,
    detail: null,
    ...overrides,
  };
}

describe("summarizeChecksPassed(#254)", () => {
  it("returns N/A(evaluated=0) instead of a fake PASS when there are no results", () => {
    const summary = summarizeChecksPassed([]);
    expect(summary).toEqual({ pass: 0, warn: 0, fail: 0, evaluated: 0, status: "N/A" });
  });

  it("aggregates FAIL > WARN > PASS across multiple results, not just the first one", () => {
    const results = [check({ status: "pass" }), check({ status: "warn" }), check({ status: "fail" })];
    const summary = summarizeChecksPassed(results);
    expect(summary).toEqual({ pass: 1, warn: 1, fail: 1, evaluated: 3, status: "FAIL" });
  });

  it("is PASS only when every evaluated result passed", () => {
    const results = [check({ status: "pass" }), check({ status: "pass" })];
    expect(summarizeChecksPassed(results).status).toBe("PASS");
  });
});

describe("summarizeByCategory(#254)", () => {
  it("filters by category and reports the worst matching result", () => {
    const results = [
      check({ category: "missing", column: "price", status: "warn", actual: 0.08, threshold: 0.05 }),
      check({ category: "duplicate", status: "pass" }),
    ];
    const summary = summarizeByCategory(results, isMissingCategory);
    expect(summary.evaluated).toBe(1);
    expect(summary.status).toBe("WARN");
    expect(summary.worst?.column).toBe("price");
  });

  it("returns N/A when no result matches the category (not a fabricated PASS)", () => {
    const summary = summarizeByCategory([check({ category: "duplicate" })], isSchemaCategory);
    expect(summary.evaluated).toBe(0);
    expect(summary.status).toBe("N/A");
    expect(summary.worst).toBeNull();
  });

  it.each([
    ["missing", isMissingCategory],
    ["null_ratio", isMissingCategory],
    ["duplicate", isDuplicateCategory],
    ["duplicates", isDuplicateCategory],
    ["schema", isSchemaCategory],
    ["schema_drift", isSchemaCategory],
  ])("category matcher accepts %s", (category, matcher) => {
    expect(matcher(category)).toBe(true);
  });
});

describe("groupByCategory(#254)", () => {
  it("groups by actual category string without assuming a fixed taxonomy", () => {
    const results = [
      check({ category: "row_count" }),
      check({ category: "missing" }),
      check({ category: "row_count" }),
    ];
    const groups = groupByCategory(results);
    expect(groups.map((g) => g.category)).toEqual(["row_count", "missing"]);
    expect(groups[0].results).toHaveLength(2);
  });

  it("returns an empty list for no results (renders as N/A, not 0%)", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("warnOrFailResults(#254)", () => {
  it("hides PASS and keeps WARN/FAIL only", () => {
    const results = [check({ status: "pass" }), check({ status: "warn" }), check({ status: "fail" })];
    expect(warnOrFailResults(results)).toHaveLength(2);
  });
});

function quality(overrides: Partial<BuildQualityResponse>): BuildQualityResponse {
  return {
    run_id: "run-1",
    availability: "available",
    evaluated_checks: 1,
    quality_results: { src: [check({ status: "pass" })] },
    schema_drift: {},
    ...overrides,
  };
}

describe("flattenQualityResults / flattenSchemaDrift(#254)", () => {
  it("returns [] for a null/undefined quality response instead of throwing", () => {
    expect(flattenQualityResults(undefined)).toEqual([]);
    expect(flattenSchemaDrift(null)).toEqual([]);
  });

  it("flattens across all sources when no sourceKey is given, and scopes when it is", () => {
    const q = quality({ quality_results: { a: [check({ source_key: "a" })], b: [check({ source_key: "b" }), check({ source_key: "b" })] } });
    expect(flattenQualityResults(q)).toHaveLength(3);
    expect(flattenQualityResults(q, "b")).toHaveLength(2);
    expect(flattenQualityResults(q, "missing-source")).toEqual([]);
  });
});

describe("overallQualityState(#254 §4 aggregation priority)", () => {
  it("is UNAVAILABLE when there is no quality response at all", () => {
    expect(overallQualityState(undefined)).toBe("UNAVAILABLE");
  });

  it("keeps availability separate and reports evaluated severity when availability=unavailable", () => {
    const q = quality({ availability: "unavailable", quality_results: { a: [check({ status: "pass" })] } });
    expect(overallQualityState(q)).toBe("PASS");
  });

  it("is NOT_EVALUATED (not PASS) when evaluated_checks is effectively 0", () => {
    const q = quality({ availability: "available", quality_results: {} });
    expect(overallQualityState(q)).toBe("NOT_EVALUATED");
  });

  it("does not collapse availability=partial into PASS: still reflects the worst real result", () => {
    const q = quality({
      availability: "partial",
      quality_results: { a: [check({ source_key: "a", status: "pass" })], b: [check({ source_key: "b", status: "fail" })] },
    });
    expect(overallQualityState(q)).toBe("FAIL");
  });

  it("uses the worst status across every source, not just the first source", () => {
    const q = quality({
      quality_results: {
        a: [check({ source_key: "a", status: "pass" })],
        b: [check({ source_key: "b", status: "pass" })],
        c: [check({ source_key: "c", status: "warn" })],
      },
    });
    expect(overallQualityState(q)).toBe("WARN");
  });
});

describe("formatQualityValue(#254 canonical rule formatting)", () => {
  it("formats percentages only for the canonical ratio/rate rules", () => {
    expect(formatQualityValue("max_null_ratio", 0.08)).toBe("8.0%");
    expect(formatQualityValue("max_duplicate_rate", 0.01)).toBe("1.0%");
    expect(formatQualityValue("custom_ratio", 0.08)).toBe("0.08");
    expect(formatQualityValue("estimated_rate", 0.01)).toBe("0.01");
  });

  it("formats min_rows as rows and preserves structured values", () => {
    expect(formatQualityValue("min_rows", 1200)).toBe("1,200행");
    expect(formatQualityValue("range", { min: 0, max: 100 })).toBe('{"min":0,"max":100}');
    expect(formatQualityValue("compare_columns", { operator: "gte", right_column: "end_date" })).toBe(
      '{"operator":"gte","right_column":"end_date"}',
    );
  });
});
