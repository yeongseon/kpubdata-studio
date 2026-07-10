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
 */
import { API_BASE } from "@/shared/config/env";

/** Builder API 계약 버전. builder #209의 API_CONTRACT_VERSION과 일치해야 한다. */
export const API_CONTRACT_VERSION = "1.0.0";

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
 * @param path - 선행 슬래시를 포함한 엔드포인트 경로(예: "/version").
 * @param options - 메서드/바디/취소 시그널/타임아웃/재시도.
 * @returns 파싱된 응답 본문.
 * @throws ApiError 응답이 2xx가 아니거나 네트워크/파싱/타임아웃 오류가 발생한 경우.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        signal: combined,
        headers: { "Content-Type": "application/json" },
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
    const message =
      extractErrorMessage(parsed) ?? `Builder API 오류 (HTTP ${response.status})`;
    throw new ApiError(response.status, message, parsed);
  }

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

// --- 응답 와이어 타입 (Builder service 실제 구현 기준) ---

export interface VersionResponse {
  service: string;
  api_version: string;
}

export type ValidateResponse =
  | { status: "valid"; dataset_id: string; api_version: string }
  | { status: "invalid"; problems: string[] }
  | { status: "error"; error: string };

export interface BuildOutcome {
  source_key: string;
  status: string;
  stages_completed: string[];
  error: string | null;
}

export interface BuildResponse {
  status: string;
  run_id: string;
  outcomes: BuildOutcome[];
  manifest: string;
  api_version: string;
}

export interface ArtifactsResponse {
  run_id: string;
  files: string[];
}

/** /preview 응답의 소스별 컬럼 스키마 항목(service app.py 기준). */
export interface PreviewColumn {
  name: string;
  dtype: string;
  nullable: boolean;
  unique_count: number;
}

/** /preview 응답의 소스별 미리보기 항목(service app.py 기준). */
export interface PreviewSource {
  source_key: string;
  status: string;
  error: string | null;
  schema: PreviewColumn[];
  sample: Record<string, unknown>[];
  total_rows: number;
}

/**
 * POST /preview 응답 와이어 형태(builder service app.py 기준).
 *
 * `{ dataset_id, previews: [...] }` — 소스별로 스키마와 샘플 행을 담는다.
 */
export interface PreviewResponse {
  dataset_id: string;
  previews: PreviewSource[];
}

/** Builder service 엔드포인트를 감싼 클라이언트. */
export const builderApi = {
  /** GET /version — 계약 버전 확인(메타). */
  version: (signal?: AbortSignal) => apiFetch<VersionResponse>("/version", { signal }),

  /** POST /validate — BuildSpec YAML 검증. */
  validate: (specYaml: string, signal?: AbortSignal) =>
    apiFetch<ValidateResponse>("/validate", { method: "POST", body: { spec: specYaml }, signal }),

  /** POST /preview — BuildSpec 기반 샘플 미리보기. */
  preview: (specYaml: string, signal?: AbortSignal) =>
    apiFetch<PreviewResponse>("/preview", { method: "POST", body: { spec: specYaml }, signal }),

  /** POST /build — 빌드 실행. run_id 생략 가능. 비멱등 요청이므로 재시도하지 않는다 (#117). */
  build: (specYaml: string, runId?: string, signal?: AbortSignal) =>
    apiFetch<BuildResponse>("/build", {
      method: "POST",
      body: runId ? { spec: specYaml, run_id: runId } : { spec: specYaml },
      signal,
      retries: 0,
    }),

  /** GET /artifacts/{runId} — 실행 산출물 파일 목록. */
  artifacts: (runId: string, signal?: AbortSignal) =>
    apiFetch<ArtifactsResponse>(`/artifacts/${encodeURIComponent(runId)}`, { signal }),
};
