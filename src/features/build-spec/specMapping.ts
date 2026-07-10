/**
 * Studio BuildSpec(camelCase) → Builder BuildSpec(snake_case) 매핑 (#37).
 *
 * Studio가 작성한 스펙을 Builder가 기대하는 필드 이름/구조로 변환한다. Builder는 YAML
 * 스펙을 받지만 JSON은 YAML의 부분집합이므로, 매핑된 객체를 JSON 문자열로 직렬화해
 * `/validate`·`/build`의 `spec` 필드로 전송할 수 있다.
 *
 * 주요 변환:
 *   - datasetId → dataset_id
 *   - exports[].format → exports[].kind (+ output_path 파생)
 *   - sources 필드(provider/dataset/params/alias)는 이름이 동일하다.
 */
import type { BuildSpec, ExportTarget } from "@/shared/lib/types";

/** Builder가 기대하는 export 대상(snake_case). */
interface BuilderExport {
  kind: string;
  output_path: string;
  options?: Record<string, unknown>;
}

/** Builder가 기대하는 BuildSpec(snake_case). */
export interface BuilderSpec {
  dataset_id: string;
  title: string;
  description: string;
  sources: Array<{
    provider: string;
    dataset: string;
    params: Record<string, string>;
    alias?: string;
  }>;
  exports: BuilderExport[];
  metadata: Record<string, string>;
}

const FORMAT_EXTENSION: Record<ExportTarget["format"], string> = {
  jsonl: "jsonl",
  markdown: "md",
  parquet: "parquet",
  huggingface: "",
};

/** Studio가 지원하는 export 형식 집합. Builder 응답의 kind 검증에 사용한다. */
const KNOWN_FORMATS = new Set<ExportTarget["format"]>(
  Object.keys(FORMAT_EXTENSION) as ExportTarget["format"][],
);

/**
 * Builder export의 kind를 Studio 형식으로 검증·변환한다.
 *
 * 알 수 없는 kind는 조용히 잘못된 스펙을 만들지 않도록 즉시 실패시킨다(#121).
 */
function parseExportFormat(kind: string): ExportTarget["format"] {
  if (KNOWN_FORMATS.has(kind as ExportTarget["format"])) {
    return kind as ExportTarget["format"];
  }
  throw new Error(`알 수 없는 export kind입니다: ${kind}`);
}

/** export별 output_path를 파생한다. huggingface는 디렉터리, 그 외는 파일 경로. */
function deriveOutputPath(spec: BuildSpec, target: ExportTarget): string {
  const base = spec.metadata["outputPath"] ?? `artifacts/builds/${spec.datasetId}`;
  if (target.format === "huggingface") {
    const outputPath = target.options?.outputPath;
    return typeof outputPath === "string" ? outputPath : base;
  }
  return `${base}/data.${FORMAT_EXTENSION[target.format]}`;
}

/**
 * Studio BuildSpec을 Builder BuildSpec 구조로 변환한다.
 *
 * @param spec - Studio 측 BuildSpec(camelCase).
 * @returns Builder가 기대하는 snake_case 스펙 객체.
 */
export function toBuilderSpec(spec: BuildSpec): BuilderSpec {
  return {
    dataset_id: spec.datasetId,
    title: spec.title,
    description: spec.description,
    sources: spec.sources.map((source) => ({
      provider: source.provider,
      dataset: source.dataset,
      params: source.params,
      ...(source.alias ? { alias: source.alias } : {}),
    })),
    exports: spec.exports.map((target) => ({
      kind: target.format,
      output_path: deriveOutputPath(spec, target),
      ...(target.options ? { options: target.options } : {}),
    })),
    metadata: spec.metadata,
  };
}

/**
 * Studio BuildSpec을 Builder가 받는 spec 텍스트(JSON=YAML 부분집합)로 직렬화한다.
 *
 * @param spec - Studio 측 BuildSpec.
 * @returns `/validate`·`/build`의 spec 필드에 넣을 문자열.
 */
export function serializeSpec(spec: BuildSpec): string {
  return JSON.stringify(toBuilderSpec(spec));
}

/**
 * Builder BuildSpec(snake_case)을 Studio BuildSpec(camelCase)으로 역변환한다.
 *
 * toBuilderSpec()의 역연산. Builder에서 저장된 스펙을 불러와 Studio에서
 * 재편집할 때 사용한다.
 */
export function fromBuilderSpec(spec: BuilderSpec): BuildSpec {
  return {
    datasetId: spec.dataset_id,
    title: spec.title,
    description: spec.description,
    sources: spec.sources.map((source) => ({
      provider: source.provider,
      dataset: source.dataset,
      params: source.params,
      ...(source.alias ? { alias: source.alias } : {}),
    })),
    exports: spec.exports.map((e) => {
      // Builder의 output_path는 Studio ExportTarget에 대응 필드가 없어 options에 보존한다(#121).
      const options: Record<string, unknown> = { ...(e.options ?? {}) };
      if (e.output_path) {
        options["outputPath"] = e.output_path;
      }
      return {
        format: parseExportFormat(e.kind),
        ...(Object.keys(options).length > 0 ? { options } : {}),
      };
    }),
    metadata: spec.metadata,
  };
}
