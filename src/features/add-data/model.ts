/**
 * Add Data Workbench(#250) 상태 모델.
 *
 * Source → Configure → Preview & Validate → Review & Build 4단계가 공유하는 draft
 * 형태와, 그 draft를 실제 제출 가능한 canonical `BuildSpec`으로 매핑하는 순수 함수를
 * 담는다. `NewBuildPage`의 `toBuildSpec`/`toFormValues`와 같은 역할이지만, Add Data는
 * kind(public_api/file/url)에 따라 서로 다른 필드 집합을 다뤄야 해서 별도로 둔다 —
 * 매핑 결과(`BuildSpec`)와 최종 제출 직렬화(`serializeSpec`/`toBuilderSpec`)는
 * `features/build-spec/specMapping.ts`를 그대로 재사용한다(#250 amendment 1).
 */
import { parseSourceParams } from "@/features/build-spec/paramsInput";
import { endpointHasRedactedSecret, redactUrlEndpoint } from "@/features/add-data/urlRedaction";
import { buildSpecSchema } from "@/shared/lib/schemas";
import type { BuildSpec, SourceFormat, SourceKind } from "@/shared/lib/types";

export interface PublicApiDraft {
  provider: string;
  dataset: string;
  /** JSON textarea 원문. `parseSourceParams`로 검증한다(NewBuildPage와 동일 로직 재사용). */
  sourceParams: string;
}

export interface FileDraft {
  /** 업로드 성공 후 Builder가 발급한 upload_id. 업로드 전에는 null. */
  uploadId: string | null;
  format: SourceFormat | null;
  encoding: string;
  /** 표시 전용 원본 파일명(Builder 응답의 original_filename을 그대로 보존). */
  filename: string | null;
  sizeBytes: number | null;
}

export interface UrlDraft {
  endpoint: string;
  /** url source의 format은 선택(csv/json/jsonl) — 생략하면 Builder가 Content-Type로 추론. */
  format: Extract<SourceFormat, "csv" | "json" | "jsonl"> | null;
}

export type PreviewSampleMode = "first" | "random";
export type PreviewLimit = 5 | 10 | 20;
export type PreviewColumnView = "key" | "all";

export interface AddDataDraft {
  /** Source 단계에서 아직 선택하지 않았으면 null. */
  sourceKind: SourceKind | null;
  publicApi: PublicApiDraft;
  file: FileDraft;
  url: UrlDraft;
  datasetId: string;
  title: string;
  description: string;
  /**
   * 사용자가 고급 설정(Dataset metadata)에서 해당 필드를 직접 수정했는지(#250 amendment 2).
   * true면 provider/dataset/파일/endpoint가 바뀌어도 자동 생성값이 더 이상 덮어쓰지 않는다
   * — `identity.ts`가 만드는 값은 어디까지나 기본값이고, 사용자가 고른 값이 항상 이긴다.
   */
  datasetIdTouched: boolean;
  titleTouched: boolean;
  descriptionTouched: boolean;
  exportFormats: string[];
  outputPath: string;
  previewLimit: PreviewLimit;
  previewSampleMode: PreviewSampleMode;
  previewColumns: PreviewColumnView;
}

export const INITIAL_DRAFT: AddDataDraft = {
  sourceKind: null,
  publicApi: { provider: "", dataset: "", sourceParams: "{}" },
  file: { uploadId: null, format: null, encoding: "utf-8", filename: null, sizeBytes: null },
  url: { endpoint: "", format: null },
  datasetId: "",
  title: "",
  description: "",
  datasetIdTouched: false,
  titleTouched: false,
  descriptionTouched: false,
  exportFormats: ["jsonl"],
  outputPath: "",
  previewLimit: 5,
  previewSampleMode: "first",
  previewColumns: "key",
};

export interface BuildSpecResult {
  spec?: BuildSpec;
  error?: string;
}

/**
 * 현재 draft로 소스 하나짜리 canonical BuildSpec을 만든다.
 *
 * @param draft - 현재 Add Data draft.
 * @returns 검증을 통과한 스펙 또는 한국어 오류 메시지.
 */
export function buildSpecFromDraft(draft: AddDataDraft): BuildSpecResult {
  if (!draft.sourceKind) {
    return { error: "Source를 먼저 선택해주세요." };
  }
  if (draft.exportFormats.length === 0) {
    return { error: "출력 형식을 최소 1개 선택해주세요." };
  }
  if (!draft.datasetId || !draft.title || !draft.description) {
    return { error: "데이터셋 ID/제목/설명을 입력해주세요." };
  }

  let source;
  if (draft.sourceKind === "public_api") {
    if (!draft.publicApi.provider || !draft.publicApi.dataset) {
      return { error: "Provider와 Dataset을 선택해주세요." };
    }
    const parsedParams = parseSourceParams(draft.publicApi.sourceParams);
    if (parsedParams.error) return { error: parsedParams.error };
    source = {
      provider: draft.publicApi.provider,
      dataset: draft.publicApi.dataset,
      params: parsedParams.data ?? {},
    };
  } else if (draft.sourceKind === "file") {
    if (!draft.file.uploadId || !draft.file.format) {
      return { error: "먼저 파일을 업로드해주세요." };
    }
    source = {
      kind: "file" as const,
      uploadId: draft.file.uploadId,
      format: draft.file.format,
      encoding: draft.file.encoding,
      params: {},
    };
  } else {
    if (!draft.url.endpoint) {
      return { error: "Endpoint를 입력해주세요." };
    }
    // 저장된 초안을 복원했는데 endpoint의 secret query parameter가 이미 REDACTED로
    // 지워져 있으면 fail-closed — placeholder를 실제 endpoint/credential처럼 Builder에
    // 제출하지 않는다(Epic #246). 사용자가 값을 다시 입력해야 Preview/Build가 가능하다.
    if (endpointHasRedactedSecret(draft.url.endpoint)) {
      return {
        error: "저장된 초안에서 시크릿이 포함된 URL 값이 제거되었습니다. Endpoint를 다시 입력해주세요.",
      };
    }
    if (!/^https:\/\//i.test(draft.url.endpoint)) {
      return { error: "https:// 로 시작하는 URL만 지원합니다." };
    }
    source = {
      kind: "url" as const,
      endpoint: draft.url.endpoint,
      method: "GET" as const,
      ...(draft.url.format ? { format: draft.url.format } : {}),
      params: {},
    };
  }

  const candidate: BuildSpec = {
    datasetId: draft.datasetId,
    title: draft.title,
    description: draft.description,
    sources: [source],
    exports: draft.exportFormats.map((format) => ({
      format,
      options: draft.outputPath ? { outputPath: draft.outputPath } : undefined,
    })),
    metadata: draft.outputPath ? { outputPath: draft.outputPath } : {},
  };

  const result = buildSpecSchema.safeParse(candidate);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "빌드 스펙이 올바르지 않습니다." };
  }
  return { spec: result.data as BuildSpec };
}

/**
 * BuildSpec(YAML 에디터에서 파싱된 결과 등)을 draft에 되반영한다.
 *
 * `buildSpecFromDraft`의 역방향 — YAML 탭에서 소스 kind 자체를 바꿔 붙여넣었을 수도
 * 있으므로 `sources[0].kind` 기준으로 draft의 kind별 bucket을 다시 채운다. Preview/식별
 * 필드(previewLimit 등)처럼 canonical BuildSpec에 없는 draft 전용 값은 그대로 둔다.
 *
 * @param draft - 되반영할 대상 draft.
 * @param spec - YAML 에디터 등에서 얻은 BuildSpec.
 * @returns 소스/식별/출력 필드가 spec 기준으로 갱신된 새 draft.
 */
export function applyBuildSpecToDraft(draft: AddDataDraft, spec: BuildSpec): AddDataDraft {
  const source = spec.sources[0];
  const kind: SourceKind = source?.kind ?? "public_api";

  const next: AddDataDraft = {
    ...draft,
    sourceKind: kind,
    datasetId: spec.datasetId,
    title: spec.title,
    description: spec.description,
    // YAML/canonical BuildSpec 편집은 고급 설정과 동급의 명시적 편집으로 취급한다 —
    // 이후 provider/dataset/파일/URL이 바뀌어도 자동 생성값이 이 값을 덮어쓰지 않는다.
    datasetIdTouched: true,
    titleTouched: true,
    descriptionTouched: true,
    exportFormats: spec.exports.map((e) => e.format),
    outputPath: spec.metadata.outputPath ?? draft.outputPath,
  };

  if (kind === "public_api") {
    next.publicApi = {
      provider: source?.provider ?? "",
      dataset: source?.dataset ?? "",
      sourceParams: source && Object.keys(source.params).length > 0
        ? JSON.stringify(source.params, null, 2)
        : "{}",
    };
  } else if (kind === "file") {
    next.file = {
      uploadId: source?.uploadId ?? null,
      format: source?.format ?? null,
      encoding: source?.encoding ?? "utf-8",
      filename: draft.file.filename,
      sizeBytes: draft.file.sizeBytes,
    };
  } else {
    next.url = {
      endpoint: source?.endpoint ?? "",
      format: (source?.format as UrlDraft["format"]) ?? null,
    };
  }

  return next;
}

/**
 * draft + preview 옵션의 서명(signature)을 만든다.
 *
 * Preview/Validate를 실행한 시점의 서명과 현재 서명이 다르면 "stale preview"로 간주해
 * Build를 막는다(`NewBuildPage`의 `validatedSnapshotRef` 패턴과 동일한 발상, #72).
 * 컬럼 뷰(key/all)·diff 화면 전환처럼 이미 받아온 응답을 다시 그리기만 하는 토글은
 * 새 Preview 호출이 필요 없으므로 서명에서 제외한다.
 */
/**
 * 표시 전용 — canonical BuildSpec에서 url source의 endpoint를 secret-redacted
 * 버전으로 바꾼 사본을 만든다(PR #283 리뷰 대응, Epic #246). Review 화면의 "실제
 * 제출될 canonical BuildSpec" preview에만 쓰며, 실제 Builder 제출에 쓰이는 spec
 * 객체는 이 함수를 거치지 않고 `buildSpecFromDraft` 결과를 그대로 쓴다.
 */
export function redactBuildSpecForDisplay(spec: BuildSpec): BuildSpec {
  const source = spec.sources[0];
  if (!source || source.kind !== "url" || !source.endpoint) return spec;
  return {
    ...spec,
    sources: [{ ...source, endpoint: redactUrlEndpoint(source.endpoint).endpoint }],
  };
}

export function draftSignature(draft: AddDataDraft): string {
  const specResult = buildSpecFromDraft(draft);
  return JSON.stringify({
    spec: specResult.spec ?? specResult.error,
    limit: draft.previewLimit,
    sampleMode: draft.previewSampleMode,
  });
}
