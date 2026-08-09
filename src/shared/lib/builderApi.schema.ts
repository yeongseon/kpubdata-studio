/**
 * Builder API 응답 Zod 스키마 (#158, #103, #159)
 *
 * Builder HTTP API 응답의 런타임 타입 검증을 위한 Zod 스키마입니다.
 * Builder SSOT(contract/builder-api.yaml)와 정합하도록 작성되었습니다.
 *
 * 사용 방법:
 * - apiFetch()에서 응답 파싱 후 zod.parse()로 런타임 검증
 * - TypeScript 타입 안정성 보장 + 런타임 데이터 정합성 검증
 * - 오류 응답도 스키마로 검증하여 사용자에게 명시적인 피드백 제공 (#159)
 */

import { z } from "zod";

/**
 * GET /version 응답 스키마
 */
export const versionResponseSchema = z.object({
  service: z.string(),
  api_version: z.string(),
});

/**
 * POST /validate 응답 스키마 (검증 성공)
 */
export const validateValidSchema = z.object({
  status: z.literal("valid"),
  dataset_id: z.string(),
  api_version: z.string(),
});

/**
 * POST /validate 응답 스키마 (검증 실패 - 문제 목록)
 */
export const validateInvalidSchema = z.object({
  status: z.literal("invalid"),
  problems: z.array(z.string()),
});

/**
 * POST /validate 응답 스키마 (스펙 로딩 오류)
 */
export const validateErrorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
});

/**
 * POST /validate 통합 응답 스키마
 */
export const validateResponseSchema = z.discriminatedUnion("status", [
  validateValidSchema,
  validateInvalidSchema,
  validateErrorSchema,
]);

/**
 * 빌드 아웃컴 (BuildOutcome) 스키마
 */
export const buildOutcomeSchema = z.object({
  source_key: z.string(),
  status: z.string(),
  stages_completed: z.array(z.string()),
  error: z.string().nullable(),
});

/**
 * POST /build 응답 스키마 (빌드 성공)
 */
export const buildOkSchema = z.object({
  status: z.literal("ok"),
  run_id: z.string(),
  outcomes: z.array(buildOutcomeSchema),
  manifest: z.string(),
  api_version: z.string(),
});

/**
 * POST /build 응답 스키마 (빌드 실패 - 하나 이상 소스 실패)
 */
export const buildFailedSchema = z.object({
  status: z.literal("failed"),
  run_id: z.string(),
  outcomes: z.array(buildOutcomeSchema),
  manifest: z.string(),
  api_version: z.string(),
});

/**
 * POST /build 통합 응답 스키마
 */
export const buildResponseSchema = z.discriminatedUnion("status", [
  buildOkSchema,
  buildFailedSchema,
]);

/**
 * GET /artifacts/{run_id} 응답 스키마
 */
export const artifactsResponseSchema = z.object({
  run_id: z.string(),
  files: z.array(z.string()),
});

/**
 * Preview 컬럼 스키마 항목
 */
export const previewColumnSchema = z.object({
  name: z.string(),
  dtype: z.string(),
  nullable: z.boolean(),
  unique_count: z.number(),
});

/**
 * Preview 소스별 미리보기 항목
 */
export const previewSourceSchema = z.object({
  source_key: z.string(),
  status: z.string(),
  error: z.string().nullable(),
  schema: z.array(previewColumnSchema),
  sample: z.array(z.record(z.string(), z.unknown())),
  total_rows: z.number(),
});

/**
 * POST /preview 응답 스키마
 */
export const previewResponseSchema = z.object({
  dataset_id: z.string(),
  previews: z.array(previewSourceSchema),
});

/**
 * ============================================
 * 오류 응답 스키마 (#159)
 * ============================================
 */

/**
 * 400 - 스펙 로딩 실패 (SpecLoadError)
 */
export const specLoadErrorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
});

/**
 * 400 - 요청 본문 누락/형식 오류
 */
export const badRequestSchema = z.object({
  error: z.string(),
});

/**
 * 404 - 리소스 없음
 */
export const notFoundSchema = z.object({
  error: z.string(),
});

/**
 * 502 - 소스 fetch/stage 실패 (일부 성공, 최소 하나 실패)
 *
 * 참고: outcomes 배열에는 성공/실패 소스가 섞여 있으며,
 * 하나라도 실패한 소스가 있으면 전체 상태는 "failed"가 됩니다.
 */
export const buildPartialFailureSchema = z.object({
  status: z.literal("failed"),
  run_id: z.string(),
  outcomes: z.array(buildOutcomeSchema),
  manifest: z.string(),
  api_version: z.string(),
});

/**
 * 통합 오류 응답 스키마
 *
 * Builder API의 다양한 오류 응답 형태를 검증합니다.
 * discriminatedUnion 대신 일반적인 z.union() 사용.
 */
export const errorResponseSchema = z.union([
  // 400 - 스펙 로딩 실패 (이미 validateResponseSchema에 있음)
  validateErrorSchema,
  // 400 - 요청 본문 오류
  badRequestSchema,
  // 404 - 리소스 없음
  notFoundSchema,
  // 502 - 빌드 부분 실패 (이미 buildResponseSchema의 failed에 있음)
  buildPartialFailureSchema,
]);

// 타입 추출 (TypeScript 타입과 일치하도록 Zod 스키마에서 추출)
export type VersionResponse = z.infer<typeof versionResponseSchema>;
export type ValidateValid = z.infer<typeof validateValidSchema>;
export type ValidateInvalid = z.infer<typeof validateInvalidSchema>;
export type ValidateError = z.infer<typeof validateErrorSchema>;
export type ValidateResponse = z.infer<typeof validateResponseSchema>;
export type BuildOutcome = z.infer<typeof buildOutcomeSchema>;
export type BuildOk = z.infer<typeof buildOkSchema>;
export type BuildFailed = z.infer<typeof buildFailedSchema>;
export type BuildResponse = z.infer<typeof buildResponseSchema>;
export type ArtifactsResponse = z.infer<typeof artifactsResponseSchema>;
export type PreviewColumn = z.infer<typeof previewColumnSchema>;
export type PreviewSource = z.infer<typeof previewSourceSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;

// 오류 응답 타입 (#159)
export type SpecLoadError = z.infer<typeof specLoadErrorSchema>;
export type BadRequest = z.infer<typeof badRequestSchema>;
export type NotFound = z.infer<typeof notFoundSchema>;
export type BuildPartialFailure = z.infer<typeof buildPartialFailureSchema>;

/**
 * GET /catalog 응답 스키마 (#416, BL2)
 */
export const catalogDatasetSchema = z.object({
  name: z.string(),
  title: z.string(),
  requires_service_key: z.boolean(),
});

export const catalogProviderSchema = z.object({
  name: z.string(),
  datasets: z.array(catalogDatasetSchema),
});

export const catalogResponseSchema = z.object({
  providers: z.array(catalogProviderSchema),
});

export type CatalogDataset = z.infer<typeof catalogDatasetSchema>;
export type CatalogProvider = z.infer<typeof catalogProviderSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
