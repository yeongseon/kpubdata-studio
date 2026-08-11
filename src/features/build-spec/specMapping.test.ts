import { describe, expect, it } from "vitest";

import type { BuilderSpec } from "./specMapping";
import { fromBuilderSpec } from "./specMapping";

const baseBuilderSpec: BuilderSpec = {
  dataset_id: "sample",
  title: "샘플",
  description: "설명",
  sources: [{ provider: "github", dataset: "repos", params: {} }],
  exports: [
    { kind: "jsonl", output_path: "artifacts/builds/sample/data.jsonl" },
  ],
  metadata: {},
};

describe("fromBuilderSpec", () => {
  it("Builder export의 output_path를 options.outputPath로 보존한다", () => {
    const result = fromBuilderSpec(baseBuilderSpec);
    expect(result.exports[0]?.options?.["outputPath"]).toBe(
      "artifacts/builds/sample/data.jsonl",
    );
  });

  it("기존 options를 유지하면서 output_path를 병합한다", () => {
    const spec: BuilderSpec = {
      ...baseBuilderSpec,
      exports: [
        {
          kind: "huggingface",
          output_path: "datasets/sample",
          options: { repoId: "org/sample" },
        },
      ],
    };
    const result = fromBuilderSpec(spec);
    expect(result.exports[0]?.options).toMatchObject({
      repoId: "org/sample",
      outputPath: "datasets/sample",
    });
  });

  it("알 수 없는 Builder export kind도 round-trip 보존한다 (#234)", () => {
    const spec: BuilderSpec = {
      ...baseBuilderSpec,
      exports: [{ kind: "csv", output_path: "exports/data.csv" }],
    };
    const result = fromBuilderSpec(spec);

    expect(result.exports[0]).toMatchObject({
      format: "csv",
      options: { outputPath: "exports/data.csv" },
    });
  });

  it("JSON params와 source schema를 Studio spec으로 보존한다 (#234)", () => {
    const spec: BuilderSpec = {
      ...baseBuilderSpec,
      sources: [
        {
          provider: "datago",
          dataset: "air_quality",
          params: { page: 1, includeMeta: true, filters: { grade: ["good"] } },
          schema: {
            required: ["station"],
            dtypes: { value: "Float64" },
            casts: { value: "float" },
          },
        },
      ],
    };
    const result = fromBuilderSpec(spec);

    expect(result.sources[0]?.params).toEqual({
      page: 1,
      includeMeta: true,
      filters: { grade: ["good"] },
    });
    expect(result.sources[0]?.schema).toEqual({
      required: ["station"],
      dtypes: { value: "Float64" },
      casts: { value: "float" },
    });
  });
});
