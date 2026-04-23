import { API_BASE } from "@/shared/config/env";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

export async function executeBuild(_spec: BuildSpec): Promise<BuildRun> {
  void API_BASE;
  throw new Error("Not implemented");
}
