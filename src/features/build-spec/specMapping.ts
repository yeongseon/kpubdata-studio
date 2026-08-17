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
import type { BuildSpec, ExportTarget, JsonValue, SourceFormat, SourceKind } from "@/shared/lib/types";

/** Builder가 기대하는 export 대상(snake_case). */
interface BuilderExport {
  kind: string;
  output_path: string;
  options?: Record<string, unknown>;
}

/** Builder가 기대하는 source 참조(snake_case, #498 kind=public_api/file/url). */
interface BuilderSourceRef {
  kind?: SourceKind;
  provider?: string;
  dataset?: string;
  params: Record<string, JsonValue>;
  alias?: string;
  /** 소스 스키마 계약 (VAL-1). Studio SourceRef.schema 와 동일 구조. */
  schema?: {
    required: string[];
    dtypes: Record<string, string>;
    casts: Record<string, string>;
  };
  upload_id?: string;
  format?: SourceFormat;
  encoding?: string;
  endpoint?: string;
  method?: "GET";
}

/** Builder가 기대하는 BuildSpec(snake_case). */
export interface BuilderSpec {
  dataset_id: string;
  title: string;
  description: string;
  sources: BuilderSourceRef[];
  exports: BuilderExport[];
  metadata: Record<string, string>;
}

/** `toBuilderSpec`/`fromBuilderSpec`이 명시적으로 모델링하는 최상위 canonical 필드. */
const KNOWN_TOP_LEVEL_FIELDS = new Set([
  "dataset_id",
  "title",
  "description",
  "sources",
  "exports",
  "metadata",
]);

const FORMAT_EXTENSION: Record<string, string> = {
  jsonl: "jsonl",
  markdown: "md",
  parquet: "parquet",
  huggingface: "",
};

/** export별 output_path를 파생한다. huggingface는 디렉터리, 그 외는 파일 경로. */
function deriveOutputPath(spec: BuildSpec, target: ExportTarget, index: number): string {
  const explicitPath = target.options?.["outputPath"];
  if (typeof explicitPath === "string" && explicitPath.length > 0) return explicitPath;

  const base = spec.metadata["outputPath"] ?? `artifacts/builds/${spec.datasetId}`;
  if (target.format === "huggingface") {
    return index === 0 ? base : `${base}-${index + 1}`;
  }
  const extension = FORMAT_EXTENSION[target.format] ?? target.format;
  const suffix = index === 0 ? "" : `-${index + 1}`;
  return `${base}/data${suffix}.${extension}`;
}

/**
 * Studio BuildSpec을 Builder BuildSpec 구조로 변환한다.
 *
 * `spec.extra`(#250, canonical round-trip)를 먼저 펼치고 Studio가 실제로 편집하는
 * 필드로 덮어써, GUI가 모델링하지 않는 최상위 필드(publish/splits/pii/...)는 보존하되
 * 폼에서 편집한 값이 항상 우선하게 한다.
 *
 * @param spec - Studio 측 BuildSpec(camelCase).
 * @returns Builder가 기대하는 snake_case 스펙 객체.
 */
export function toBuilderSpec(spec: BuildSpec): BuilderSpec {
  return {
    ...(spec.extra ?? {}),
    dataset_id: spec.datasetId,
    title: spec.title,
    description: spec.description,
    sources: spec.sources.map((source) => ({
      ...(source.kind && source.kind !== "public_api" ? { kind: source.kind } : {}),
      ...(source.provider !== undefined ? { provider: source.provider } : {}),
      ...(source.dataset !== undefined ? { dataset: source.dataset } : {}),
      params: source.params,
      ...(source.alias ? { alias: source.alias } : {}),
      ...(source.schema ? { schema: source.schema } : {}),
      ...(source.uploadId ? { upload_id: source.uploadId } : {}),
      ...(source.format ? { format: source.format } : {}),
      ...(source.encoding ? { encoding: source.encoding } : {}),
      ...(source.endpoint ? { endpoint: source.endpoint } : {}),
      ...(source.method ? { method: source.method } : {}),
    })),
    exports: spec.exports.map((target, index) => ({
      kind: target.format,
      output_path: deriveOutputPath(spec, target, index),
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
 * 재편집할 때(#120), 그리고 YAML 에디터에서 파싱한 스펙을 GUI로 반영할 때(#250) 사용한다.
 *
 * `spec`은 `BuilderSpec`이 명시적으로 모델링하는 필드 외의 임의 최상위 키를 가질 수
 * 있다(YAML 텍스트를 그대로 파싱한 원본 객체) — 그런 키는 삭제하지 않고 `extra`에
 * 보존한다(#250 canonical field round-trip). 호출부는 Zod로 *검증만* 하고, 이 함수에는
 * 항상 파싱 직후의 원본 객체를 넘겨야 한다 — Zod `.parse()` 결과를 넘기면 스키마에
 * 없는 키가 조용히 strip될 수 있다.
 *
 * 파라미터 타입은 `BuilderSpec`(알려진 필드만)이지만, 런타임에는 YAML을 그대로 파싱한
 * 객체처럼 그 외 임의 키를 실제로 가질 수 있다 — TS가 그 키들의 존재를 알 수 없을 뿐이다.
 */
export function fromBuilderSpec(spec: BuilderSpec): BuildSpec {
  const extra: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(spec as unknown as Record<string, unknown>)) {
    if (!KNOWN_TOP_LEVEL_FIELDS.has(key)) extra[key] = value as JsonValue;
  }

  return {
    datasetId: spec.dataset_id,
    title: spec.title,
    description: spec.description,
    sources: spec.sources.map((source) => ({
      ...(source.kind && source.kind !== "public_api" ? { kind: source.kind } : {}),
      ...(source.provider !== undefined ? { provider: source.provider } : {}),
      ...(source.dataset !== undefined ? { dataset: source.dataset } : {}),
      params: source.params,
      ...(source.alias ? { alias: source.alias } : {}),
      ...(source.schema ? { schema: source.schema } : {}),
      ...(source.upload_id ? { uploadId: source.upload_id } : {}),
      ...(source.format ? { format: source.format } : {}),
      ...(source.encoding ? { encoding: source.encoding } : {}),
      ...(source.endpoint ? { endpoint: source.endpoint } : {}),
      ...(source.method ? { method: source.method } : {}),
    })),
    exports: spec.exports.map((e) => {
      // Builder의 output_path는 Studio ExportTarget에 대응 필드가 없어 options에 보존한다(#121).
      const options: Record<string, unknown> = { ...(e.options ?? {}) };
      if (e.output_path) {
        options["outputPath"] = e.output_path;
      }
      return {
        format: e.kind,
        ...(Object.keys(options).length > 0 ? { options } : {}),
      };
    }),
    metadata: spec.metadata,
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}
