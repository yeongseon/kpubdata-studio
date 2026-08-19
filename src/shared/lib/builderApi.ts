/**
 * Builder HTTP API 클라이언트 (#29).
 *
 * kpubdata-builder service(`service/app.py`)가 실제로 제공하는 엔드포인트
 * (`/version`, `/validate`, `/preview`, `/build`, `/artifacts/{run_id}`)를 감싼다.
 * Builder API 계약(API_CONTRACT.md / builder #209)의 와이어 형태에 맞춰 요청/응답
 * 타입을 정의하고, 비정상 응답은 구조화된 `ApiError`로 던진다.
 *
 * 라이브 Builder 없이도 Studio가 동작하도록, 기본값은 mock이며 실제 호출은
 * `VITE_USE_REAL_BUILDER=true`일 때만 활성화된다(각 feature 모듈에서 분기).
 *
 * 주의: validate/preview/build는 Builder가 BuildSpec YAML(snake_case)을 기대하므로,
 * Studio BuildSpec(camelCase) → Builder 스펙 매핑(#37)이 선행되어야 완전히 연결된다.
 * 이 모듈은 그 매핑이 끝난 스펙 텍스트를 받는 저수준 계약 계층이다.
 *
 * 런타임 타입 검증 (#158, #103):
 * - 모든 응답은 Zod 스키마로 런타임 검증된다.
 * - as T 캐스팅 대신 zod.parse()를 사용하여 타입 안정성을 보장한다.
 */
import { API_BASE } from "@/shared/config/env";
import * as schemas from "./builderApi.schema";
import { z } from "zod";

/**
 * Studio가 실제로 검토·연동한 Builder API 계약 버전(고정 pin, "최신 Builder main과 항상
 * 동일"이 아니다). 1.17.0은 Builder PR #547에서 검토한 idempotent publish
 * readiness/POST 계약까지 포함한다.
 *
 * Builder는 additive 변경마다 이 값을 계속 올린다. Studio는 자신이 실제로 검토·
 * 연동한 버전만 고정한다 — 현재는 async build job과 publish 표면까지 검토·연동했다.
 * 미연동 operation(예:
 * provider credentials 1.8.0, monitoring 1.11.0)은 여기 숫자에 반영해도 실제
 * 호출이 없으므로 따로 올리지 않는다. pin 정책 자체는 builder ADR 0013(#521)의
 * 기능별 최소 SemVer 판정으로 전환 중이다.
 */
export const API_CONTRACT_VERSION = "1.17.0";

/** 실제 Builder 호출 활성화 여부(미설정 시 mock 사용). */
export function isRealBuilderEnabled(): boolean {
  return import.meta.env.VITE_USE_REAL_BUILDER === "true";
}

/** Builder가 반환한 비정상 응답을 표현하는 구조화 에러. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  /** 자동 타임아웃(ms). 미지정 시 DEFAULT_TIMEOUT_MS. 0 이하이면 타임아웃 비활성화. */
  timeoutMs?: number;
  /** 네트워크 오류·5xx 발생 시 추가 재시도 횟수(지수 백오프). 미지정 시 DEFAULT_RETRIES. */
  retries?: number;
  /** 인증 헤더 생략 (/healthz 등 무인증 엔드포인트, #186). */
  skipAuth?: boolean;
}

/**
 * Builder 요청에 붙일 Bearer 토큰을 제공하는 provider (#186).
 * null을 반환하면 해당 요청에 Authorization 헤더를 붙이지 않는다 —
 * mock 모드·미로그인 상태에서 빈 헤더가 나가는 것을 방지한다.
 */
export type AuthTokenProvider = () => string | null;

// Studio는 서버가 없는 정적 SPA라 토큰을 메모리(zustand 스토어)에만 보관한다 (#187 예정).
// apiFetch는 주입받은 provider를 통해 그 토큰을 읽는다 — 전역을 직접 참조하면 테스트가 어렵다.
let authTokenProvider: AuthTokenProvider | null = null;

/**
 * Builder 요청에 붙일 Bearer 토큰 provider를 등록한다 (#186).
 * provider를 null로(또는 해제) 두면 인증 헤더가 나가지 않아, 미로그인/mock 모드에서
 * 기존 요청 형태와 완전히 동일하게 동작한다(회귀 없음).
 */
export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

export type AuthErrorCallback = () => void;

let authErrorCallback: AuthErrorCallback | null = null;

export function setAuthErrorCallback(cb: AuthErrorCallback | null): void {
  authErrorCallback = cb;
}

/** 자동 타임아웃 기본값(ms). Builder /build는 외부 API를 호출해 느릴 수 있어 넉넉히 잡는다. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** 네트워크 오류·5xx에 대한 기본 재시도 횟수(최초 시도 외 추가 횟수). */
export const DEFAULT_RETRIES = 2;

/** 타임아웃으로 요청이 중단됐는지 식별하는 ApiError 상태값. */
const TIMEOUT_STATUS = 408;

/** 재시도 사이 지수 백오프 지연(ms)을 만든다. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 사용자 취소 signal과 타임아웃 signal을 결합해, 둘 중 먼저 발화하는 쪽이 요청을 중단하게 한다.
 *
 * @param signal - 호출자가 넘긴 취소 signal(선택).
 * @param timeoutMs - 자동 타임아웃(ms). 0 이하이면 타임아웃 없이 signal만 사용한다.
 * @returns 결합된 signal과, 타임아웃 타이머를 해제하는 cleanup 함수.
 */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (timeoutMs <= 0) return { signal, cleanup: () => {} };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const cleanup = () => clearTimeout(timer);

  if (!signal) return { signal: controller.signal, cleanup };
  if (signal.aborted) {
    cleanup();
    return { signal, cleanup: () => {} };
  }
  // 사용자 취소가 발생하면 타임아웃 컨트롤러도 함께 중단해 fetch를 즉시 끊는다.
  signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  return { signal: controller.signal, cleanup };
}

/** 타임아웃 때문에 발생한 abort인지 판별한다(사용자 취소와 구분). */
function isTimeoutAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "TimeoutError";
}

/**
 * Builder API에 JSON 요청을 보내고 JSON 응답을 파싱한다.
 *
 * 네트워크 일시 장애와 5xx에는 지수 백오프로 제한 재시도하고(#94), 응답이 없을 경우
 * UI가 무한 대기에 빠지지 않도록 자동 타임아웃을 건다(#94). 호출자 취소 signal은 그대로 존중한다.
 *
 * 런타임 타입 검증 (#158, #103):
 * - 스키마가 제공되면 Zod로 런타임 검증을 수행한다.
 * - 검증 실패 시 ApiError를 던진다.
 *
 * @param path - 선행 슬래시를 포함한 엔드포인트 경로(예: "/version").
 * @param options - 메서드/바디/취소 시그널/타임아웃/재시도.
 * @param schema - 응답을 검증할 Zod 스키마 (선택).
 * @returns 파싱된 응답 본문.
 * @throws ApiError 응답이 2xx가 아니거나 네트워크/파싱/타임아웃/스키마 검증 오류가 발생한 경우.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
  schema?: z.ZodSchema<T>,
): Promise<T> {
  const {
    method = "GET",
    body,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
  } = options;

  let response: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal: combined, cleanup } = withTimeout(signal, timeoutMs);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    try {
      if (!options.skipAuth) {
        const token = authTokenProvider?.() ?? null;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      response = await fetch(`${API_BASE}${path}`, {
        method,
        signal: combined,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      cleanup();
      // 호출자가 명시적으로 취소한 경우엔 재시도하지 않고 그대로 전파한다.
      if (signal?.aborted) throw cause;
      if (isTimeoutAbort(cause)) {
        if (attempt < retries) {
          await delay(500 * 2 ** attempt);
          continue;
        }
        throw new ApiError(TIMEOUT_STATUS, "Builder API 응답이 시간 내에 오지 않았습니다.", cause);
      }
      // 네트워크 오류: 남은 재시도가 있으면 백오프 후 다시 시도한다.
      if (attempt < retries) {
        await delay(500 * 2 ** attempt);
        continue;
      }
      throw new ApiError(0, "Builder API에 연결하지 못했습니다.", cause);
    }
    cleanup();

    // 5xx는 일시 장애일 수 있어 제한 재시도한다. 4xx는 즉시 처리(재시도 무의미).
    if (response.status >= 500 && attempt < retries) {
      await delay(500 * 2 ** attempt);
      response = undefined;
      continue;
    }
    break;
  }

  if (!response) {
    throw new ApiError(0, "Builder API에 연결하지 못했습니다.");
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!response.ok) throw new ApiError(response.status, text);
      throw new ApiError(response.status, "응답 JSON을 파싱하지 못했습니다.");
    }
  }

  if (!response.ok) {
    if (response.status === 401 && authErrorCallback) {
      authErrorCallback();
    }
    const message = formatApiErrorMessage(response.status, parsed);
    throw new ApiError(response.status, message, parsed);
  }

  // Zod 스키마로 런타임 타입 검증 (#158, #103)
  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      // 스키마 불일치 시 사용자에게 표시 가능한 명시적 에러 (#159)
      const errorDetails = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `\`${issue.path.join(".")}\`` : "응답 구조";
        const message = issue.message || "형식 불일치";
        return `${path}: ${message}`;
      }).join(", ");

      throw new ApiError(
        500,
        `Builder API 응답이 예상된 형식과 일치하지 않습니다: ${errorDetails}`,
        parsed,
      );
    }
    return result.data;
  }

  // 스키마가 없는 경우 (하위 호환): as T 캐스팅만 수행
  return parsed as T;
}

/**
 * Builder의 비정상 응답 본문에서 사람이 읽을 메시지를 추출한다.
 *
 * 우선순위(하위 호환 유지):
 *   1) 최상위 `error` 필드(있으면 그대로 사용 — builder PR이 추가 중).
 *   2) `outcomes[].error` — 실패한 소스별 사유(join). /build 502의 실제 와이어 형태.
 *
 * @param parsed - 파싱된 응답 본문(unknown).
 * @returns 추출한 메시지 또는 undefined.
 */
export function extractErrorMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as { error?: unknown; outcomes?: unknown };

  if (record.error != null && record.error !== "") {
    return String(record.error);
  }

  if (Array.isArray(record.outcomes)) {
    const reasons = record.outcomes
      .map((outcome) =>
        outcome && typeof outcome === "object" && "error" in outcome
          ? (outcome as { error?: unknown }).error
          : undefined,
      )
      .filter((reason): reason is string => typeof reason === "string" && reason.length > 0);
    if (reasons.length > 0) return reasons.join("; ");
  }

  return undefined;
}

/**
 * HTTP 상태 코드와 응답 본문을 사용자에게 표시 가능한 에러 메시지로 변환합니다 (#159).
 *
 * @param status - HTTP 상태 코드
 * @param parsed - 파싱된 응답 본문
 * @returns 사용자에게 표시할 수 있는 명시적인 에러 메시지
 */
export function formatApiErrorMessage(status: number, parsed: unknown): string {
  // 먼저 구조화된 에러 메시지 추출 시도
  const extracted = extractErrorMessage(parsed);
  if (extracted) return extracted;

  // 상태 코드별 기본 메시지
  const statusMessages: Record<number, string> = {
    400: "요청 형식이 올바르지 않습니다.",
    401: "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요.",
    403: "접근 권한이 없습니다. 관리자에게 권한을 요청하세요. (재로그인으로 해결되지 않습니다)",
    404: "요청한 리소스를 찾을 수 없습니다.",
    405: "Method Not Allowed",
    408: "요청 시간이 초과되었습니다.",
    429: "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.",
    500: "서버 내부 오류가 발생했습니다.",
    502: "데이터 소스에서 오류가 발생했습니다.",
    503: "인증 서비스에 일시적 장애가 있습니다. 잠시 후 다시 시도해주세요.",
    504: "Gateway Timeout",
  };

  const baseMessage = statusMessages[status] ?? `Builder API 오류 (HTTP ${status})`;

  // 응답에 추가 정보가 있는 경우 덧붙임
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (record.run_id) {
      return `${baseMessage} (빌드 ID: ${record.run_id})`;
    }
    if (record.dataset_id) {
      return `${baseMessage} (데이터셋 ID: ${record.dataset_id})`;
    }
    if (record.source_key) {
      return `${baseMessage} (소스: ${record.source_key})`;
    }
  }

  return baseMessage;
}

/** GET /builds 응답의 단일 빌드 요약(builder contract BuildSummary 기준). */
export interface BuildSummary {
  /** 빌드 실행 식별자 */
  run_id: string;
  /** 빌드 상태("ok" | "failed") */
  status: "ok" | "failed";
  /** 빌드 시작 시각(ISO 8601, null, 또는 생략됨) */
  started_at?: string | null;
  /** 빌드 완료 시각(ISO 8601, null, 또는 생략됨) */
  finished_at?: string | null;
}

/** GET /builds 응답 와이어 형태(builder contract BuildsResponse 기준). */
export interface BuildsResponse {
  builds: BuildSummary[];
}

// --- 응답 타입 (Zod 스키마에서 추출) ---

export type VersionResponse = schemas.VersionResponse;
export type ValidateResponse = schemas.ValidateResponse;
export type BuildOutcome = schemas.BuildOutcome;
export type BuildResponse = schemas.BuildResponse;
export type ArtifactsResponse = schemas.ArtifactsResponse;
export type PreviewColumn = schemas.PreviewColumn;
export type PreviewSource = schemas.PreviewSource;
export type PreviewResponse = schemas.PreviewResponse;
export type CatalogDataset = schemas.CatalogDataset;
export type CatalogProvider = schemas.CatalogProvider;
export type CatalogResponse = schemas.CatalogResponse;
export type StageStatus = schemas.StageStatus;
export type DatasetSourceRef = schemas.DatasetSourceRef;
export type SourceStageStatus = schemas.SourceStageStatus;
export type DatasetSummary = schemas.DatasetSummary;
export type DatasetDetailResponse = schemas.DatasetDetailResponse;
export type DatasetsResponse = schemas.DatasetsResponse;
export type DatasetRunSummary = schemas.DatasetRunSummary;
export type DatasetRunsResponse = schemas.DatasetRunsResponse;
export type RunStageEntry = schemas.RunStageEntry;
export type RunStagesResponse = schemas.RunStagesResponse;
export type StageDetailResponse = schemas.StageDetailResponse;
export type QualityCheckResult = schemas.QualityCheckResult;
export type SchemaDriftFinding = schemas.SchemaDriftFinding;
export type BuildQualityResponse = schemas.BuildQualityResponse;
export type DatasetQualityHistoryEntry = schemas.DatasetQualityHistoryEntry;
export type DatasetQualityHistoryResponse = schemas.DatasetQualityHistoryResponse;
export type QueryStage = schemas.QueryStage;
export type QueryRequest = schemas.QueryRequest;
export type QueryResponse = schemas.QueryResponse;
export type QueryErrorCode = schemas.QueryErrorCode;
export type PublishTarget = schemas.PublishTarget;
export type PublishIssue = schemas.PublishIssue;
export type PublishReadinessResponse = schemas.PublishReadinessResponse;
export type PublishHuggingFaceOptions = schemas.PublishHuggingFaceOptions;
export type PublishRequest = schemas.PublishRequest;
export type PublishResponse = schemas.PublishResponse;
export type PublishErrorCode = schemas.PublishErrorCode;
export type PublishErrorResponse = schemas.PublishErrorResponse;
export type PublishBlockedResponse = schemas.PublishBlockedResponse;

/** Builder service 엔드포인트를 감싼 클라이언트. */
export const builderApi = {
  /** GET /version — 계약 버전 확인(메타). */
  version: (signal?: AbortSignal) =>
    apiFetch("/version", { signal }, schemas.versionResponseSchema),

  /** POST /validate — BuildSpec YAML 검증. */
  validate: (specYaml: string, signal?: AbortSignal) =>
    apiFetch("/validate", { method: "POST", body: { spec: specYaml }, signal }, schemas.validateResponseSchema),

  /** POST /preview — BuildSpec 기반 샘플 미리보기. */
  preview: (specYaml: string, signal?: AbortSignal) =>
    apiFetch("/preview", { method: "POST", body: { spec: specYaml }, signal }, schemas.previewResponseSchema),

  /** POST /build — 빌드 실행. run_id 생략 가능. 비멱등 요청이므로 재시도하지 않는다 (#117). */
  build: (specYaml: string, runId?: string, signal?: AbortSignal) =>
    apiFetch(
      "/build",
      {
        method: "POST",
        body: runId ? { spec: specYaml, run_id: runId } : { spec: specYaml },
        signal,
        retries: 0,
      },
      schemas.buildResponseSchema,
    ),

  /** POST /builds — 비동기 build job 제출 (#245, builder #482/#480). 재시도하지 않는다. */
  submitBuild: (specYaml: string, runId?: string, signal?: AbortSignal) =>
    apiFetch(
      "/builds",
      {
        method: "POST",
        body: runId ? { spec: specYaml, run_id: runId } : { spec: specYaml },
        signal,
        retries: 0,
      },
      schemas.buildJobSchema,
    ),

  /** GET /builds/{run_id} — 비동기 build job 상태 polling (#245, builder #482/#480). */
  getBuildJob: (runId: string, signal?: AbortSignal) =>
    apiFetch(
      `/builds/${encodeURIComponent(runId)}`,
      { signal, retries: 1 },
      schemas.buildJobSchema,
    ),

  /** GET /artifacts/{runId} — 실행 산출물 파일 목록. */
  artifacts: (runId: string, signal?: AbortSignal) =>
    apiFetch(`/artifacts/${encodeURIComponent(runId)}`, { signal }, schemas.artifactsResponseSchema),

  /** GET /builds — 빌드 이력 목록(#153, builder #250). */
  listBuilds: (limit?: number, signal?: AbortSignal) => {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    return apiFetch<BuildsResponse>(`/builds${query}`, { signal });
  },

  /** GET /catalog — provider/dataset 카탈로그 (#416, BL2). */
  catalog: (signal?: AbortSignal) =>
    apiFetch("/catalog", { signal }, schemas.catalogResponseSchema),

  /** GET /datasets — 실제 built dataset 목록. `/catalog` 원천 목록과 구분한다. */
  listDatasets: (limit?: number, signal?: AbortSignal) => {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    return apiFetch(`/datasets${query}`, { signal }, schemas.datasetsResponseSchema);
  },

  /** GET /datasets/{dataset_id} — latest accessible run 기준 dataset 상세. */
  getDataset: (datasetId: string, signal?: AbortSignal) =>
    apiFetch(
      `/datasets/${encodeURIComponent(datasetId)}`,
      { signal },
      schemas.datasetDetailResponseSchema,
    ),

  /** GET /datasets/{dataset_id}/runs — dataset의 접근 가능한 run history. */
  listDatasetRuns: (datasetId: string, limit?: number, signal?: AbortSignal) => {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    return apiFetch(
      `/datasets/${encodeURIComponent(datasetId)}/runs${query}`,
      { signal },
      schemas.datasetRunsResponseSchema,
    );
  },

  /** GET /builds/{run_id}/stages — source별 Bronze/Silver/Gold 상태. */
  listBuildStages: (runId: string, signal?: AbortSignal) =>
    apiFetch(
      `/builds/${encodeURIComponent(runId)}/stages`,
      { signal },
      schemas.runStagesResponseSchema,
    ),

  /** GET /builds/{run_id}/stages/{stage} — 선택 source/stage의 안전한 상세. */
  getBuildStageDetail: (
    runId: string,
    stage: schemas.StageDetailResponse["stage"],
    source: string,
    limit?: number,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ source });
    if (limit !== undefined) params.set("limit", String(limit));
    return apiFetch(
      `/builds/${encodeURIComponent(runId)}/stages/${stage}?${params.toString()}`,
      { signal },
      schemas.stageDetailResponseSchema,
    );
  },

  /** GET /builds/{run_id}/quality — run scoped quality와 schema drift. */
  getBuildQuality: (runId: string, signal?: AbortSignal) =>
    apiFetch(
      `/builds/${encodeURIComponent(runId)}/quality`,
      { signal },
      schemas.buildQualityResponseSchema,
    ),

  /** GET /builds/{run_id}/publish/readiness — Builder가 계산한 게시 준비 상태. */
  getPublishReadiness: (
    runId: string,
    target: schemas.PublishTarget,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ target });
    return apiFetch(
      `/builds/${encodeURIComponent(runId)}/publish/readiness?${params.toString()}`,
      { signal, retries: 0 },
      schemas.publishReadinessResponseSchema,
    );
  },

  /** POST /builds/{run_id}/publish — 원격 side effect이므로 클라이언트 자동 재시도 금지. */
  publishBuild: (runId: string, request: schemas.PublishRequest, signal?: AbortSignal) =>
    apiFetch(
      `/builds/${encodeURIComponent(runId)}/publish`,
      { method: "POST", body: request, signal, retries: 0, timeoutMs: 0 },
      schemas.publishResponseSchema,
    ),

  /** GET /datasets/{dataset_id}/quality/history — dataset quality 이력. */
  getDatasetQualityHistory: (datasetId: string, limit?: number, signal?: AbortSignal) => {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    return apiFetch(
      `/datasets/${encodeURIComponent(datasetId)}/quality/history${query}`,
      { signal },
      schemas.datasetQualityHistoryResponseSchema,
    );
  },

  /**
   * POST /query — server-resolved Silver/Gold table에 read-only SQL 실행 (#504, 1.7.0).
   *
   * Bronze는 Builder가 거부한다(Studio도 UI 단에서 선제 차단, `features/kubi/query.ts`).
   * SQL은 사용자가 명시적으로 실행을 선택했을 때만 호출해야 하며, 자동 재시도하지 않는다
   * (429/504가 이미 포화·타임아웃 신호이므로 재시도가 상황을 악화시킬 수 있다).
   */
  query: (request: schemas.QueryRequest, signal?: AbortSignal) =>
    apiFetch(
      "/query",
      { method: "POST", body: request, signal, retries: 0 },
      schemas.queryResponseSchema,
    ),
};
