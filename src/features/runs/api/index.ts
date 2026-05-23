/**
 * 빌드 실행(run) API 진입점.
 *
 * 실제 Builder 실행 요청이 붙기 전까지는 타입과 흐름만 유지하는 스텁 역할을 한다.
 */
import { API_BASE } from "@/shared/config/env";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

/**
 * 새 빌드 실행을 시작하고 실행 상태 객체를 반환한다.
 *
 * @param _spec - 실행할 빌드 스펙.
 * @returns 생성된 빌드 실행 정보.
 * @throws Error 아직 실제 실행 API 연동이 구현되지 않았을 때 발생한다.
 */
export async function executeBuild(_spec: BuildSpec): Promise<BuildRun> {
  void API_BASE;
  throw new Error("Not implemented");
}
