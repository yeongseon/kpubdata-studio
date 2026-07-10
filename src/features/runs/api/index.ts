/**
 * 빌드 실행(run) API 진입점.
 *
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)면 Builder `/build`를 호출하고, 아니면
 * 결정적 mock 실행 결과를 반환한다. Builder의 /build는 현재 동기식이므로 비동기 job
 * 폴링은 Builder 측 job 엔드포인트가 생기면 확장한다(#39).
 */
import { serializeSpec } from "@/features/build-spec/specMapping";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { DEMO_DATASETS, type DemoDataset } from "@/shared/lib/demoDatasets";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

const MOCK_TIME = "1970-01-01T00:00:00.000Z";

/**
 * BuildSpec으로부터 경로 안전한 run_id를 생성한다.
 *
 * Builder는 run_id를 산출물 디렉터리 이름으로 사용하므로 안전한 세그먼트
 * (영숫자/하이픈)만 남긴다. dataset id와 타임스탬프를 결합해 사람이 식별 가능하면서도
 * 충돌하지 않는 값을 만든다.
 */
export function generateRunId(datasetId: string): string {
  const slug = datasetId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const base = slug.length > 0 ? slug : "build";
  return `${base}-${Date.now()}`;
}

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
  const runId = generateRunId(spec.datasetId);
  const startedAt = new Date().toISOString();
  const result = await builderApi.build(serializeSpec(spec), runId, signal);
  return {
    id: result.run_id,
    spec,
    status: result.status === "ok" ? "succeeded" : "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

/** 데모 카탈로그 항목을 목록/이력 UI용 BuildSpec으로 변환한다. */
function mockSpec(dataset: DemoDataset): BuildSpec {
  return {
    datasetId: dataset.slug,
    title: dataset.title,
    description: dataset.description,
    sources: [
      {
        provider: "datago",
        dataset: dataset.providerDataset,
        params: dataset.params,
      },
    ],
    exports: dataset.exports,
    metadata: {
      source_url: dataset.sourceUrl,
      hf_repo: dataset.hfRepo,
    },
  };
}

/** mock 모드에서 보여줄 결정적 빌드 이력(실제 builder 데이터셋 스펙 기반). */
function mockBuilds(): BuildRun[] {
  return DEMO_DATASETS.map((dataset) => ({
    id: dataset.buildId,
    spec: mockSpec(dataset),
    status: dataset.status,
    startedAt: dataset.startedAt,
    finishedAt: dataset.finishedAt,
  }));
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

