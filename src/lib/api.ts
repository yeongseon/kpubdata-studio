import type { BuildManifest, BuildRun, BuildSpec } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_BUILDER_API_URL ?? "http://localhost:8000";

export async function validateSpec(
  _spec: BuildSpec,
): Promise<{ valid: boolean; errors: string[] }> {
  void API_BASE;
  return { valid: true, errors: [] };
}

export async function previewBuild(
  _spec: BuildSpec,
): Promise<{ rows: Record<string, unknown>[]; schema: Record<string, string> }> {
  void API_BASE;
  return { rows: [], schema: {} };
}

export async function executeBuild(_spec: BuildSpec): Promise<BuildRun> {
  void API_BASE;
  throw new Error("Not implemented");
}

export async function getBuildManifest(_buildId: string): Promise<BuildManifest> {
  void API_BASE;
  throw new Error("Not implemented");
}
