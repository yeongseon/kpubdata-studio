import { describe, expect, it } from "vitest";
import { resolveKubiRouteContext } from "@/features/kubi/context";

describe("resolveKubiRouteContext (#247)", () => {
  it("labels the home route", () => {
    expect(resolveKubiRouteContext("/").pageLabel).toBe("Home");
  });

  it("labels each top-level IA route", () => {
    expect(resolveKubiRouteContext("/discover").pageLabel).toBe("Discover");
    expect(resolveKubiRouteContext("/workspace").pageLabel).toBe("Workspace");
    expect(resolveKubiRouteContext("/add").pageLabel).toBe("Add Data");
    expect(resolveKubiRouteContext("/quality").pageLabel).toBe("Quality");
    expect(resolveKubiRouteContext("/kubi").pageLabel).toBe("Kubi");
    expect(resolveKubiRouteContext("/reports").pageLabel).toBe("Reports");
    expect(resolveKubiRouteContext("/provider").pageLabel).toBe("Provider");
    expect(resolveKubiRouteContext("/monitoring").pageLabel).toBe("Monitoring");
  });

  it("extracts datasetId from a dataset detail route", () => {
    const context = resolveKubiRouteContext("/datasets/air-quality");
    expect(context.pageLabel).toBe("Dataset 상세");
    expect(context.datasetId).toBe("air-quality");
  });

  it("does not treat the dataset catalog itself as a dataset id", () => {
    const context = resolveKubiRouteContext("/datasets");
    expect(context.pageLabel).toBe("Dataset Catalog");
    expect(context.datasetId).toBeUndefined();
  });

  it("extracts buildId from build-scoped routes but not from /builds/new", () => {
    expect(resolveKubiRouteContext("/builds/run-1").buildId).toBe("run-1");
    expect(resolveKubiRouteContext("/builds/run-1/run").buildId).toBe("run-1");
    expect(resolveKubiRouteContext("/builds/new").buildId).toBeUndefined();
    expect(resolveKubiRouteContext("/builds").buildId).toBeUndefined();
  });
});
