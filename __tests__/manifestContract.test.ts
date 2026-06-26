/**
 * BuildManifest 타입 ↔ Builder manifest 와이어 형태 정합성 테스트 (#98).
 *
 * Builder `manifest/writer.py`가 디스크에 기록하는 JSON payload를 그대로 Studio의 BuildManifest로
 * 받아도 타입 오류 없이 모든 필드가 매핑되는지 고정한다. 한쪽 구조가 바뀌면 컴파일/테스트가 깨져
 * 크로스 레포 불일치를 조기에 잡는다. (이전 camelCase·recordCount 단일 합계 형태는 실제 출력과 달랐다.)
 */
import { describe, expect, it } from "vitest";
import type { BuildManifest } from "@/shared/lib/types";

// Builder manifest/writer.py payload 그대로(snake_case, 정렬 키).
const WIRE_MANIFEST: BuildManifest = {
  schema_version: "1.0.0",
  build_id: "run-air-quality-1",
  started_at: "2026-06-21T00:00:00+00:00",
  finished_at: "2026-06-21T00:00:08+00:00",
  build_environment: {
    python_version: "3.12.3",
    kpubdata_version: "0.4.0",
    builder_version: "0.4.0",
  },
  inputs: ["datago.air-quality"],
  inputs_fingerprint: "sha256:abc",
  outputs: ["artifacts/builds/run-air-quality-1/data.jsonl"],
  warnings: [],
  errors: [],
  row_counts: { "datago.air-quality": 12304 },
  schema_summaries: {
    "datago.air-quality": {
      fields: [{ name: "sidoName", type: "string", nullable: false }],
      total_fields: 1,
    },
  },
  provenance: [
    {
      provider: "datago",
      dataset: "air-quality",
      fetched_at: "2026-06-21T00:00:05+00:00",
      record_count: 12304,
      data_checksum: "sha256:def",
      api_version: "unknown",
      params: { sidoName: "서울" },
    },
  ],
};

describe("BuildManifest contract (#98)", () => {
  it("accepts the real Builder manifest wire shape with all fields populated", () => {
    expect(WIRE_MANIFEST.build_id).toBe("run-air-quality-1");
    expect(WIRE_MANIFEST.row_counts["datago.air-quality"]).toBe(12304);
    expect(WIRE_MANIFEST.schema_summaries["datago.air-quality"].total_fields).toBe(1);
    expect(WIRE_MANIFEST.provenance[0].data_checksum).toBe("sha256:def");
    expect(WIRE_MANIFEST.build_environment?.builder_version).toBe("0.4.0");
  });

  it("allows null build_environment and inputs_fingerprint (no inputs case)", () => {
    const empty: BuildManifest = {
      ...WIRE_MANIFEST,
      build_environment: null,
      inputs: [],
      inputs_fingerprint: null,
      row_counts: {},
      schema_summaries: {},
      provenance: [],
    };
    expect(empty.build_environment).toBeNull();
    expect(empty.inputs_fingerprint).toBeNull();
  });
});
