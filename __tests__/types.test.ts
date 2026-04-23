import { describe, expect, it } from "vitest";
import type { BuildRun, BuildSpec, DraftStatus } from "@/shared/lib/types";

describe("studio domain types", () => {
  it("allows typed build spec and run models", () => {
    const status: DraftStatus = "validated";

    const spec: BuildSpec = {
      datasetId: "dataset-001",
      title: "Sample Build",
      description: "Build description",
      sources: [
        {
          provider: "kosis",
          dataset: "population",
          params: { region: "seoul" },
          alias: "population_source",
        },
      ],
      exports: [{ format: "jsonl", options: { compression: "gzip" } }],
      metadata: { owner: "studio" },
    };

    const run: BuildRun = {
      id: "run-001",
      spec,
      status: "queued",
      startedAt: "2025-01-01T00:00:00Z",
    };

    expect(status).toBe("validated");
    expect(run.spec.datasetId).toBe("dataset-001");
    expect(run.status).toBe("queued");
  });
});
