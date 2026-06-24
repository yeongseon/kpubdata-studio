/**
 * 빌드 스펙 검증 API 진입점.
 *
 * 실제 Builder 연동이 켜져 있으면(`VITE_USE_REAL_BUILDER=true`) Builder `/validate`를
 * 호출하고, 아니면 mock(항상 valid)을 반환해 Studio가 독립 동작하도록 한다(#29/#37).
 */
import { serializeSpec } from "@/features/build-spec/specMapping";
import { ApiError, builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildSpec } from "@/shared/lib/types";

/** ApiError.details가 Builder의 invalid 응답({status, problems})인지 판별한다. */
function asInvalidDetails(details: unknown): { problems: string[] } | null {
  if (details && typeof details === "object" && "status" in details) {
    const record = details as { status?: unknown; problems?: unknown };
    if (record.status === "invalid") {
      return { problems: Array.isArray(record.problems) ? record.problems.map(String) : [] };
    }
  }
  return null;
}

/**
 * 현재 빌드 스펙을 검증하고 오류 목록을 반환한다.
 *
 * @param spec - 검증 대상 빌드 스펙.
 * @returns 유효성 통과 여부와 오류 문자열 목록.
 */
export async function validateSpec(
  spec: BuildSpec,
): Promise<{ valid: boolean; errors: string[] }> {
  if (!isRealBuilderEnabled()) {
    return { valid: true, errors: [] };
  }

  try {
    const result = await builderApi.validate(serializeSpec(spec));
    // 2xx로 invalid/error가 올 수도 있으므로 status별로 사유를 매핑한다.
    if (result.status === "valid") return { valid: true, errors: [] };
    if (result.status === "invalid") {
      return { valid: false, errors: result.problems.map(String) };
    }
    return { valid: false, errors: [result.error] };
  } catch (cause) {
    // Builder가 검증 실패를 400 + {status:"invalid", problems}으로 돌려주는 경우도 처리한다.
    if (cause instanceof ApiError) {
      const invalid = asInvalidDetails(cause.details);
      if (invalid) return { valid: false, errors: invalid.problems };
    }
    throw cause;
  }
}
