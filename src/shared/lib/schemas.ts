import { z } from "zod";

export const exportFormatSchema = z.enum([
  "markdown",
  "jsonl",
  "parquet",
  "huggingface",
]);

export const recordSchema = z.record(z.string(), z.string());

export const sourceRefSchema = z.object({
  provider: z.string().min(1, "Provider is required."),
  dataset: z.string().min(1, "Dataset is required."),
  params: recordSchema,
  alias: z.string().min(1, "Alias cannot be empty.").optional(),
});

export const exportTargetSchema = z.object({
  format: exportFormatSchema,
  options: recordSchema.optional(),
});

export const buildSpecSchema = z.object({
  datasetId: z.string().min(1, "Dataset ID is required."),
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  sources: z.array(sourceRefSchema).min(1, "At least one source is required."),
  exports: z.array(exportTargetSchema).min(1, "Select at least one export format."),
  metadata: recordSchema,
});

export type BuildSpecInput = z.infer<typeof buildSpecSchema>;
export type ExportTargetInput = z.infer<typeof exportTargetSchema>;
export type SourceRefInput = z.infer<typeof sourceRefSchema>;
