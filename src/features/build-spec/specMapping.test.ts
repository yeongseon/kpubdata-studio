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

  it("알 수 없는 kind는 즉시 예외를 던진다", () => {
    const spec: BuilderSpec = {
      ...baseBuilderSpec,
      exports: [{ kind: "unknown-format", output_path: "x" }],
    };
    expect(() => fromBuilderSpec(spec)).toThrow(/알 수 없는 export kind/);
  });
});
