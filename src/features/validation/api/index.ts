/**
 * 빌드 스펙 검증 API와 연결될 기능 모듈의 진입점.
 *
 * 현재는 스텁 응답만 반환하지만, 이후 Builder 백엔드 검증 엔드포인트를 호출하는 자리다.
 */
import { API_BASE } from "@/shared/config/env";
import type { BuildSpec } from "@/shared/lib/types";

/**
 * 현재 빌드 스펙을 검증하고 오류 목록을 반환한다.
 *
 * @param _spec - 검증 대상 빌드 스펙. 실제 구현 시 요청 본문으로 전송된다.
 * @returns 유효성 통과 여부와 오류 문자열 목록.
 */
export async function validateSpec(
  _spec: BuildSpec,
): Promise<{ valid: boolean; errors: string[] }> {
  void API_BASE;
  return { valid: true, errors: [] };
}
