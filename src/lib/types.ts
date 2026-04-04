export type DraftStatus = "new" | "dirty" | "validated" | "invalid";

export type BuildRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PublishStatus =
  | "not_started"
  | "ready"
  | "publishing"
  | "published"
  | "publish_failed";

export interface BuildSpec {
  datasetId: string;
  title: string;
  description: string;
  sources: SourceRef[];
  exports: ExportTarget[];
  metadata: Record<string, string>;
}

export interface SourceRef {
  provider: string;
  dataset: string;
  params: Record<string, string>;
  alias?: string;
}

export interface ExportTarget {
  format: "markdown" | "jsonl" | "parquet" | "huggingface";
  options?: Record<string, string>;
}

export interface BuildManifest {
  buildId: string;
  startedAt: string;
  finishedAt: string;
  sources: SourceRef[];
  artifactPaths: string[];
  recordCount: number;
  warnings: string[];
  errors: string[];
}

export interface BuildDraft {
  spec: BuildSpec;
  status: DraftStatus;
  lastModified: string;
}

export interface BuildRun {
  id: string;
  spec: BuildSpec;
  status: BuildRunStatus;
  manifest?: BuildManifest;
  startedAt: string;
  finishedAt?: string;
}
