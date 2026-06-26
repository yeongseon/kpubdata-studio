/**
 * 빌드 실행(run) API 진입점.
 *
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)면 Builder `/build`를 호출하고, 아니면
 * 결정적 mock 실행 결과를 반환한다. Builder의 /build는 현재 동기식이므로 비동기 job
 * 폴링은 Builder 측 job 엔드포인트가 생기면 확장한다(#39).
 */
import { serializeSpec } from "@/features/build-spec/specMapping";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

const MOCK_TIME = "1970-01-01T00:00:00.000Z";

/**
 * 새 빌드 실행을 시작하고 실행 결과를 반환한다.
 *
 * @param spec - 실행할 빌드 스펙.
 * @param signal - 취소용 AbortSignal(선택).
 * @returns 생성된 빌드 실행 정보.
 */
export async function executeBuild(spec: BuildSpec, signal?: AbortSignal): Promise<BuildRun> {
  if (!isRealBuilderEnabled()) {
    return {
      id: "mock-run",
      spec,
      status: "succeeded",
      startedAt: MOCK_TIME,
      finishedAt: MOCK_TIME,
    };
  }

  // 실연동 모드에서는 실제 실행 시각을 기록한다(이력/상세 화면에서 잘못된 1970 값 방지).
  const startedAt = new Date().toISOString();
  const result = await builderApi.build(serializeSpec(spec), undefined, signal);
  return {
    id: result.run_id,
    spec,
    status: result.status === "ok" ? "succeeded" : "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
  };
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

/** mock 모드에서 보여줄 결정적 빌드 이력. */
function mockBuilds(): BuildRun[] {
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

/**
 * 빌드 실행 이력 목록을 조회한다 (#12, #95).
 *
 * mock 모드(`VITE_USE_REAL_BUILDER` 미설정)에서는 이력 표/검색/정렬 UI를 개발·검증할 수
 * 있도록 결정적 mock 목록을 반환한다.
 *
 * 실연동 모드에서는 Builder에 이력 목록 엔드포인트(`GET /builds`)가 아직 없다(builder #250).
 * 그 전까지 mock 데이터를 실데이터처럼 보여주면 사용자를 오도하므로, 실연동 모드에서는
 * 가짜 이력을 만들지 않고 빈 목록을 반환한다. Builder에 `GET /builds`가 추가되면 이 분기에서
 * 해당 API를 호출하고 응답을 BuildRun[]으로 매핑하도록 확장한다(executeBuild의 실연동 패턴과 동일).
 *
 * @returns 빌드 실행 목록(mock 모드: 결정적 mock, 실연동 모드: 현재는 빈 목록).
 */
export async function listBuilds(): Promise<BuildRun[]> {
  if (!isRealBuilderEnabled()) {
    return mockBuilds();
  }

  // TODO(builder #250): Builder에 GET /builds가 추가되면 실제 이력을 호출·매핑한다.
  // 그 전까지는 가짜 이력 대신 빈 목록을 반환해 실연동 모드에서 mock을 노출하지 않는다.
  return [];
}

