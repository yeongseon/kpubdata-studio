/**
 * Kubi 구조화 LLM 응답 Zod 스키마 (#256).
 *
 * `LLM 출력 → Zod → catalog/evidence 대조 → Builder validate/query → 사용자 승인` 4단계
 * 환각 차단 파이프라인의 첫 관문. Zod는 "모양"만 검증한다 — 실제 존재하는 리소스인지는
 * `crossCheck.ts`가 evidence/catalog와 대조해서 판단한다.
 *
 * Suggested Action은 issue #256이 고정한 allowlist(OPEN_PROVIDER/OPEN_BUILD/OPEN_QUALITY/
 * PATCH_BUILDSPEC/CREATE_BUILD_DRAFT/ADD_REPORT_BLOCK) 6종만 discriminated union으로
 * 허용한다. 목록 밖 action은 zod 단계에서 그대로 거부된다(알 수 없는 action 실행 금지).
 */
import { z } from "zod";
import { jsonValueSchema } from "@/shared/lib/schemas";

export const KUBI_STAGES = ["bronze", "silver", "gold"] as const;
export const KUBI_QUERY_STAGES = ["silver", "gold"] as const;

/** BuildSpec 패치 한 건. RFC6902 JSON Patch의 안전한 부분집합(add/replace/remove)만 허용한다. */
export const buildSpecPatchOpSchema = z.object({
  op: z.enum(["add", "replace", "remove"]),
  path: z.string().min(1),
  value: jsonValueSchema.optional(),
});
export type BuildSpecPatchOp = z.infer<typeof buildSpecPatchOpSchema>;

const openProviderActionSchema = z.object({
  type: z.literal("OPEN_PROVIDER"),
  provider: z.string().min(1),
  reason: z.string().min(1),
});

const openBuildActionSchema = z.object({
  type: z.literal("OPEN_BUILD"),
  runId: z.string().min(1),
  reason: z.string().min(1),
});

const openQualityActionSchema = z.object({
  type: z.literal("OPEN_QUALITY"),
  datasetId: z.string().min(1),
  runId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  stage: z.enum(KUBI_STAGES).optional(),
  reason: z.string().min(1),
});

const patchBuildSpecActionSchema = z.object({
  type: z.literal("PATCH_BUILDSPEC"),
  runId: z.string().min(1),
  patch: z.array(buildSpecPatchOpSchema).min(1),
  reason: z.string().min(1),
});

const createBuildDraftActionSchema = z.object({
  type: z.literal("CREATE_BUILD_DRAFT"),
  values: z.object({
    datasetId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    provider: z.string().min(1),
    sourceDataset: z.string().min(1),
    sourceParams: z.string().optional(),
    outputPath: z.string().optional(),
    exportFormats: z.array(z.string()).optional(),
  }),
  reason: z.string().min(1),
});

const addReportBlockActionSchema = z.object({
  type: z.literal("ADD_REPORT_BLOCK"),
  note: z.string().min(1),
  reason: z.string().min(1),
});

/** Issue #256이 고정한 allowlist. 목록 밖 값은 discriminatedUnion이 그대로 reject한다. */
export const kubiActionSchema = z.discriminatedUnion("type", [
  openProviderActionSchema,
  openBuildActionSchema,
  openQualityActionSchema,
  patchBuildSpecActionSchema,
  createBuildDraftActionSchema,
  addReportBlockActionSchema,
]);
export type KubiAction = z.infer<typeof kubiActionSchema>;

export const kubiEvidenceRefSchema = z.object({
  kind: z.enum(["dataset", "run", "stage", "quality", "schema_drift", "catalog"]),
  id: z.string().min(1),
  label: z.string().min(1),
});

export const kubiGeneratedSqlSchema = z.object({
  sql: z.string().min(1),
  stage: z.enum(KUBI_QUERY_STAGES),
  source: z.string().min(1).optional(),
});

/** LLM에게 요청하는 최상위 JSON 응답 형태. */
export const kubiStructuredResponseSchema = z.object({
  answer: z.string().min(1),
  evidenceRefs: z.array(kubiEvidenceRefSchema).default([]),
  generatedSql: kubiGeneratedSqlSchema.nullable().default(null),
  suggestedActions: z.array(kubiActionSchema).default([]),
});
export type KubiStructuredResponseInput = z.infer<typeof kubiStructuredResponseSchema>;
