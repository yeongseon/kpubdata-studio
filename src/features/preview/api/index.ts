/**
 * 빌드 결과 미리보기 API 진입점.
 *
 * 실제 구현 시 Builder가 반환한 샘플 행과 스키마를 UI가 바로 사용할 수 있는 형태로 전달한다.
 */
import { API_BASE } from "@/shared/config/env";
import type { BuildSpec } from "@/shared/lib/types";

/**
 * 현재 빌드 스펙으로 미리보기 데이터를 요청한다.
 *
 * @param _spec - 미리보기를 생성할 대상 빌드 스펙.
 * @returns 샘플 행 배열과 컬럼 스키마 맵.
 */
export async function previewBuild(
  _spec: BuildSpec,
): Promise<{ rows: Record<string, unknown>[]; schema: Record<string, string> }> {
  void API_BASE;
  return { rows: [], schema: {} };
}
