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

/** 목록/이력 UI 개발용 결정적 mock 스펙을 만든다. */
function mockSpec(datasetId: string, title: string): BuildSpec {
  return {
    datasetId,
    title,
    description: `${title} 빌드`,
    sources: [{ provider: "datago", dataset: datasetId, params: {} }],
    exports: [{ format: "jsonl" }],
    metadata: {},
  };
}

/**
 * 빌드 실행 이력 목록을 조회한다 (#12).
 *
 * #29 Builder API 연동 전까지는 결정적 mock 목록을 반환해 이력 표/검색/정렬 UI를
 * 개발·검증할 수 있게 한다.
 *
 * @returns 빌드 실행 목록(mock).
 */
export async function listBuilds(): Promise<BuildRun[]> {
  void API_BASE;
  return [
    {
      id: "run-air-quality-3",
      spec: mockSpec("air-quality", "대기오염 정보"),
      status: "succeeded",
      startedAt: "2026-06-21T09:00:00.000Z",
      finishedAt: "2026-06-21T09:00:08.000Z",
    },
    {
      id: "run-weather-2",
      spec: mockSpec("kma-daily", "기상청 일별 관측"),
      status: "failed",
      startedAt: "2026-06-20T18:30:00.000Z",
      finishedAt: "2026-06-20T18:30:05.000Z",
    },
    {
      id: "run-population-1",
      spec: mockSpec("kosis-population", "인구 통계"),
      status: "running",
      startedAt: "2026-06-21T10:15:00.000Z",
    },
  ];
}
