import { API_BASE } from "@/shared/config/env";
import type { BuildSpec } from "@/shared/lib/types";

export async function validateSpec(
  _spec: BuildSpec,
): Promise<{ valid: boolean; errors: string[] }> {
  void API_BASE;
  return { valid: true, errors: [] };
}
