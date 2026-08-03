import { beforeEach, describe, expect, it } from "vitest";
import {
  SPEC_STORE_LIMIT,
  clearBuildSpecs,
  hasBuildSpec,
  loadBuildSpec,
  saveBuildSpec,
} from "./specStore";
import type { BuildSpec } from "@/shared/lib/types";

function makeSpec(overrides: Partial<BuildSpec> = {}): BuildSpec {
  return {
    datasetId: "air-quality",
    title: "대기오염 정보",
    description: "시도별 실시간 대기오염 측정값",
    sources: [{ provider: "datago", dataset: "air", params: { sidoName: "서울" } }],
    exports: [{ format: "jsonl" }],
    metadata: { outputPath: "artifacts/builds/air", source_url: "https://example.test" },
    ...overrides,
  };
}

describe("specStore", () => {
  beforeEach(() => {
    clearBuildSpecs();
  });

  it("저장한 스펙을 run id로 되돌려준다", () => {
    const spec = makeSpec();
    saveBuildSpec("run-1", spec);

    expect(loadBuildSpec("run-1")).toEqual(spec);
    expect(hasBuildSpec("run-1")).toBe(true);
  });

  it("여러 소스와 폼에 없는 메타데이터를 그대로 보존한다", () => {
    const spec = makeSpec({
      sources: [
        { provider: "datago", dataset: "air", params: {} },
        { provider: "datago", dataset: "water", params: { region: "busan" } },
      ],
      metadata: { outputPath: "out", hf_repo: "org/dataset", source_url: "https://example.test" },
    });
    saveBuildSpec("run-multi", spec);

    const loaded = loadBuildSpec("run-multi");
    expect(loaded?.sources).toHaveLength(2);
    expect(loaded?.metadata.hf_repo).toBe("org/dataset");
  });

  it("저장된 적 없는 run id는 null을 반환한다", () => {
    expect(loadBuildSpec("unknown")).toBeNull();
    expect(hasBuildSpec("unknown")).toBe(false);
  });

  it("빈 run id는 저장하지도 조회하지도 않는다", () => {
    saveBuildSpec("", makeSpec());
    expect(loadBuildSpec("")).toBeNull();
  });

  it("스키마를 통과하지 못하는 손상된 값은 버린다", () => {
    saveBuildSpec("run-broken", makeSpec());
    // 저장 이후 스펙 형태가 바뀌었거나 값이 손상된 상황을 흉내낸다.
    const raw = JSON.parse(localStorage.getItem("kpubdata-studio:build-specs") as string) as {
      entries: Record<string, { spec: unknown }>;
    };
    raw.entries["run-broken"].spec = { datasetId: 123 };
    localStorage.setItem("kpubdata-studio:build-specs", JSON.stringify(raw));

    expect(loadBuildSpec("run-broken")).toBeNull();
  });

  it("봉투 버전이 다르면 조용히 정리한다", () => {
    localStorage.setItem(
      "kpubdata-studio:build-specs",
      JSON.stringify({ version: 999, entries: { "run-1": { spec: makeSpec(), savedAt: "x" } } }),
    );

    expect(loadBuildSpec("run-1")).toBeNull();
    expect(localStorage.getItem("kpubdata-studio:build-specs")).toBeNull();
  });

  it("상한을 넘으면 오래된 항목부터 버린다", () => {
    for (let i = 0; i < SPEC_STORE_LIMIT + 5; i++) {
      saveBuildSpec(`run-${String(i).padStart(3, "0")}`, makeSpec({ datasetId: `ds-${i}` }));
    }

    // 가장 먼저 저장한 항목은 밀려나고, 마지막 항목은 남아 있어야 한다.
    expect(loadBuildSpec("run-000")).toBeNull();
    expect(loadBuildSpec(`run-${String(SPEC_STORE_LIMIT + 4).padStart(3, "0")}`)).not.toBeNull();
  });
});
