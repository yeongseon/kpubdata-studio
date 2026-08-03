/**
 * Builder API 응답 Zod 스키마 (#158, #103)
 *
 * Builder HTTP API 응답의 런타임 타입 검증을 위한 Zod 스키마입니다.
 * Builder SSOT(contract/builder-api.yaml)와 정합하도록 작성되었습니다.
 *
 * 사용 방법:
 * - apiFetch()에서 응답 파싱 후 zod.parse()로 런타임 검증
 * - TypeScript 타입 안정성 보장 + 런타임 데이터 정합성 검증
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
