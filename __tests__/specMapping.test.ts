import { describe, expect, it } from "vitest";
import { serializeSpec, toBuilderSpec } from "@/features/build-spec/specMapping";
import type { BuildSpec } from "@/shared/lib/types";

const spec: BuildSpec = {
  datasetId: "air-quality",
  title: "대기오염",
  description: "설명",
  sources: [{ provider: "datago", dataset: "air", params: { sidoName: "서울" }, alias: "aq" }],
  exports: [{ format: "jsonl" }, { format: "huggingface", options: { outputPath: "hf/aq" } }],
  metadata: { outputPath: "artifacts/builds/aq" },
};

describe("toBuilderSpec (#37)", () => {
  it("maps camelCase Studio fields to snake_case Builder fields", () => {
    const result = toBuilderSpec(spec);
    expect(result.dataset_id).toBe("air-quality");
    expect(result.sources[0]).toEqual({
      provider: "datago",
      dataset: "air",
      params: { sidoName: "서울" },
      alias: "aq",
    });
  });

  it("maps export format → kind and derives output_path", () => {
    const result = toBuilderSpec(spec);
    expect(result.exports[0]).toEqual({
      kind: "jsonl",
      output_path: "artifacts/builds/aq/data.jsonl",
    });
    // huggingface는 디렉터리 경로(옵션 우선).
    expect(result.exports[1].kind).toBe("huggingface");
    expect(result.exports[1].output_path).toBe("hf/aq");
  });

  it("omits alias when absent", () => {
    const noAlias = toBuilderSpec({
      ...spec,
      sources: [{ provider: "datago", dataset: "air", params: {} }],
    });
    expect(noAlias.sources[0]).not.toHaveProperty("alias");
  });

  it("serializeSpec returns parseable JSON (a YAML subset)", () => {
    const parsed = JSON.parse(serializeSpec(spec));
    expect(parsed.dataset_id).toBe("air-quality");
  });
});
