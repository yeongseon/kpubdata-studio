/**
 * 빌드 결과 아티팩트/manifest 조회 API 진입점.
 *
 * 현재는 스텁 예외를 던지지만, 이후 Builder 결과 조회 엔드포인트를 감싸게 된다.
 */
import { API_BASE } from "@/shared/config/env";
import type { BuildManifest } from "@/shared/lib/types";

/**
 * 특정 빌드 실행의 manifest 정보를 조회한다.
 *
 * @param _buildId - 조회 대상 빌드 실행 ID.
 * @returns 빌드 manifest 정보.
 * @throws Error 아직 실제 API 연동이 구현되지 않았을 때 발생한다.
 */
export async function getBuildManifest(_buildId: string): Promise<BuildManifest> {
  void API_BASE;
  throw new Error("Not implemented");
}
