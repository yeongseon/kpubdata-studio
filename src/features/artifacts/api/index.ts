import { API_BASE } from "@/shared/config/env";
import type { BuildManifest } from "@/shared/lib/types";

export async function getBuildManifest(_buildId: string): Promise<BuildManifest> {
  void API_BASE;
  throw new Error("Not implemented");
}
