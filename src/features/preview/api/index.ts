/**
 * 빌드 결과 미리보기 API 진입점 (#93).
 *
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)면 Builder `/preview`를 호출하고, 아니면
 * UI 개발/검증용 결정적 mock 데이터를 반환한다. Builder가 반환한 소스별 샘플 행과 스키마를
 * UI가 바로 사용할 수 있는 `{ rows, schema }` 형태로 변환한다(runs/api의 실연동 분기 패턴과 동일).
 */
import { serializeSpec } from "@/features/build-spec/specMapping";
import {
  builderApi,
  isRealBuilderEnabled,
  type PreviewResponse,
} from "@/shared/lib/builderApi";
import type { BuildSpec } from "@/shared/lib/types";

/** 미리보기 결과(샘플 행 배열과 컬럼명→타입 스키마 맵). */
export interface PreviewResult {
  rows: Record<string, unknown>[];
  schema: Record<string, string>;
}

/** mock 모드에서 보여줄 결정적 샘플 행. */
const MOCK_ROWS: Record<string, unknown>[] = [
  { region: "서울", value: 42, measured_at: "2026-06-21T09:00:00Z" },
  { region: "부산", value: 37, measured_at: "2026-06-21T09:00:00Z" },
  { region: "대구", value: 51, measured_at: "2026-06-21T09:00:00Z" },
];

/** mock 모드에서 보여줄 결정적 컬럼 스키마. */
const MOCK_SCHEMA: Record<string, string> = {
  region: "string",
  value: "int64",
  measured_at: "string",
};

/**
 * Builder /preview 응답을 UI가 쓰는 `{ rows, schema }`로 변환한다.
 *
 * /preview는 소스별 배열(`previews`)을 반환한다. 미리보기 화면은 단일 표를 보여주므로
 * 첫 번째 성공 소스를 대표로 사용한다(소스가 없으면 빈 결과).
 *
 * @param response - Builder /preview 응답.
 * @returns 대표 소스의 샘플 행과 컬럼명→타입 스키마.
 */
function transformPreviewResponse(response: PreviewResponse): PreviewResult {
  const source =
    response.previews.find((preview) => preview.status === "ok") ?? response.previews[0];
  if (!source) return { rows: [], schema: {} };

  const schema: Record<string, string> = {};
  for (const column of source.schema) {
    schema[column.name] = column.dtype;
  }
  return { rows: source.sample, schema };
}

/**
 * 현재 빌드 스펙으로 미리보기 데이터를 요청한다.
 *
 * @param spec - 미리보기를 생성할 대상 빌드 스펙.
 * @param signal - 취소용 AbortSignal(선택).
 * @returns 샘플 행 배열과 컬럼 스키마 맵.
 */
export async function previewBuild(spec: BuildSpec, signal?: AbortSignal): Promise<PreviewResult> {
  if (!isRealBuilderEnabled()) {
    return { rows: MOCK_ROWS, schema: MOCK_SCHEMA };
  }

  const response = await builderApi.preview(serializeSpec(spec), signal);
  return transformPreviewResponse(response);
}
