import { API_BASE } from "@/shared/config/env";
import type { BuildSpec } from "@/shared/lib/types";

export async function previewBuild(
  _spec: BuildSpec,
): Promise<{ rows: Record<string, unknown>[]; schema: Record<string, string> }> {
  void API_BASE;
  return { rows: [], schema: {} };
}
