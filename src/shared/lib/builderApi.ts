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
}

/**
 * Builder API에 JSON 요청을 보내고 JSON 응답을 파싱한다.
 *
 * @param path - 선행 슬래시를 포함한 엔드포인트 경로(예: "/version").
 * @param options - 메서드/바디/취소 시그널.
 * @returns 파싱된 응답 본문.
 * @throws ApiError 응답이 2xx가 아니거나 네트워크/파싱 오류가 발생한 경우.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, "Builder API에 연결하지 못했습니다.", cause);
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
      (parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : undefined) ?? `Builder API 오류 (HTTP ${response.status})`;
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
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

/** Builder service 엔드포인트를 감싼 클라이언트. */
export const builderApi = {
  /** GET /version — 계약 버전 확인(메타). */
  version: (signal?: AbortSignal) => apiFetch<VersionResponse>("/version", { signal }),

  /** POST /validate — BuildSpec YAML 검증. */
  validate: (specYaml: string, signal?: AbortSignal) =>
    apiFetch<ValidateResponse>("/validate", { method: "POST", body: { spec: specYaml }, signal }),

  /** POST /build — 빌드 실행. run_id 생략 가능. */
  build: (specYaml: string, runId?: string, signal?: AbortSignal) =>
    apiFetch<BuildResponse>("/build", {
      method: "POST",
      body: runId ? { spec: specYaml, run_id: runId } : { spec: specYaml },
      signal,
    }),

  /** GET /artifacts/{runId} — 실행 산출물 파일 목록. */
  artifacts: (runId: string, signal?: AbortSignal) =>
    apiFetch<ArtifactsResponse>(`/artifacts/${encodeURIComponent(runId)}`, { signal }),
};
