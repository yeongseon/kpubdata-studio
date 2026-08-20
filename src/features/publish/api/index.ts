/** Builder PR #547의 publish HTTP 계약을 Studio 공용 API 계층에 연결한다. */
import {
  ApiError,
  builderApi,
  type PublishErrorCode,
  type PublishReadinessResponse,
  type PublishRequest,
  type PublishResponse,
  type PublishTarget,
} from "@/shared/lib/builderApi";

export type {
  PublishIssue,
  PublishReadinessResponse,
  PublishRequest,
  PublishResponse,
  PublishTarget,
} from "@/shared/lib/builderApi";

const HUGGING_FACE_DESTINATION =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function validatePublishDestination(destination: string): string | undefined {
  if (!destination.trim()) return "Hugging Face destination을 입력하세요.";
  if (!HUGGING_FACE_DESTINATION.test(destination)) {
    return "destination은 owner/dataset 형식이어야 합니다.";
  }
  return undefined;
}

export function getPublishReadiness(
  runId: string,
  target: PublishTarget = "huggingface",
  signal?: AbortSignal,
): Promise<PublishReadinessResponse> {
  return builderApi.getPublishReadiness(runId, target, signal);
}

export function publishBuild(
  runId: string,
  request: PublishRequest,
  signal?: AbortSignal,
): Promise<PublishResponse> {
  return builderApi.publishBuild(runId, request, signal);
}

export type PublishFailureKind = PublishErrorCode | "forbidden" | "not_found" | "network" | "invalid_request" | "readiness_changed" | "unknown";

export interface PublishFailure {
  kind: PublishFailureKind;
  message: string;
}

function errorCode(cause: ApiError): PublishErrorCode | undefined {
  if (!cause.details || typeof cause.details !== "object") return undefined;
  const code = (cause.details as { code?: unknown }).code;
  if (
    code === "unsupported_target" ||
    code === "publish_in_progress" ||
    code === "publish_state_unknown" ||
    code === "publish_conflict" ||
    code === "publish_failed"
  ) return code;
  return undefined;
}

/** 서버 원문/HTML/secret을 화면에 되비추지 않고 stable status/code만 번역한다. */
export function describePublishFailure(cause: unknown): PublishFailure {
  if (!(cause instanceof ApiError)) {
    return { kind: "unknown", message: "게시 요청을 완료하지 못했습니다." };
  }

  const code = errorCode(cause);
  if (code === "publish_in_progress") {
    return { kind: code, message: "같은 게시 작업이 이미 진행 중입니다." };
  }
  if (code === "publish_state_unknown") {
    return { kind: code, message: "이전 게시 결과를 확인할 수 없어 자동 재시도가 차단되었습니다. Builder 운영자에게 상태 확인을 요청하세요." };
  }
  if (code === "publish_conflict") {
    return { kind: code, message: "같은 Run과 destination이 다른 공개 설정으로 이미 게시되었습니다." };
  }
  if (code === "publish_failed" || cause.status === 502) {
    return { kind: code ?? "unknown", message: "외부 게시 서비스에서 작업을 완료하지 못했습니다. 결과가 불명확할 수 있으므로 자동 재시도하지 않습니다." };
  }
  if (cause.status === 409) return { kind: "readiness_changed", message: "게시 직전 Builder 재검증에서 준비 상태가 변경되었습니다. readiness를 다시 확인하세요." };
  if (cause.status === 403) return { kind: "forbidden", message: "이 Run을 게시할 권한이 없습니다." };
  if (cause.status === 404) return { kind: "not_found", message: "선택한 Run을 Builder에서 찾을 수 없습니다." };
  if (cause.status === 0 || cause.status === 408) return { kind: "network", message: "Builder 응답을 받지 못했습니다. 원격 게시 결과는 확인되지 않았습니다." };
  if (cause.status === 400 || code === "unsupported_target") return { kind: code ?? "invalid_request", message: "게시 요청 형식이 Builder 계약과 일치하지 않습니다." };
  return { kind: "unknown", message: "Builder에서 게시 요청을 완료하지 못했습니다." };
}

export function isSafePublishReference(reference: string): boolean {
  try {
    const url = new URL(reference);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
