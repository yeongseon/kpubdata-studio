/**
 * 빌드 실행(run) API 진입점.
 *
 * 실연동 모드(`VITE_USE_REAL_BUILDER=true`)면 Builder `/build`를 호출하고, 아니면
 * 결정적 mock 실행 결과를 반환한다. Builder의 /build는 현재 동기식이므로 비동기 job
 * 폴링은 Builder 측 job 엔드포인트가 생기면 확장한다(#39).
 */
import { saveBuildSpec } from "@/features/build-spec/specStore";
import { serializeSpec } from "@/features/build-spec/specMapping";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { DEMO_DATASETS, type DemoDataset } from "@/shared/lib/demoDatasets";
import type { BuildListItem, BuildRun, BuildSpec } from "@/shared/lib/types";

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
/** Builder 잡 상태를 Studio 실행 상태로 매핑한다 (builder 1.16.0 #480). */
export type BuilderJobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled";

export async function executeBuild(
  spec: BuildSpec,
  signal?: AbortSignal,
  onJobStatus?: (status: BuilderJobStatus) => void,
): Promise<BuildRun> {
  if (!isRealBuilderEnabled()) {
    const mockRun: BuildRun = {
      id: "mock-run",
      spec,
      status: "succeeded",
      startedAt: MOCK_TIME,
      finishedAt: MOCK_TIME,
    };
    // mock 모드에서도 편집 흐름을 실제와 같은 경로로 검증할 수 있도록 스펙을 보관한다.
    saveBuildSpec(mockRun.id, spec);
    return mockRun;
  }

  // 실연동 모드에서는 실제 실행 시각을 기록한다(이력/상세 화면에서 잘못된 1970 값 방지).
  const runId = generateRunId(spec.datasetId);
  const startedAt = new Date().toISOString();
  const result = await runAsyncBuild(spec, runId, startedAt, signal, onJobStatus);

  // Builder는 spec을 영속화하지 않으므로(#120), 이후 편집 화면이 기존 스펙을 복원할 수
  // 있도록 Studio가 실행 시점의 스펙을 run_id에 묶어 보관한다. 저장 실패는 무시되며
  // 빌드 결과에는 영향을 주지 않는다.
  saveBuildSpec(result.id, spec);

  return result;
}

const POLL_INTERVAL_MS = 800;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function runAsyncBuild(
  spec: BuildSpec,
  runId: string,
  startedAt: string,
  signal: AbortSignal | undefined,
  onJobStatus: ((status: BuilderJobStatus) => void) | undefined,
): Promise<BuildRun> {
  const submitted = await builderApi.submitBuild(serializeSpec(spec), runId, signal);
  onJobStatus?.(submitted.status);

  // 제출 직후 이미 terminal인 경우(동일 run_id 재제출 등) 폴링 없이 바로 판정한다.
  let job = submitted;
  while (job.status !== "succeeded" && job.status !== "failed" && job.status !== "cancelled") {
    await sleep(POLL_INTERVAL_MS, signal);
    job = await builderApi.getBuildJob(runId, signal);
    onJobStatus?.(job.status);
  }

  const finishedAt = job.updated_at;
  if (job.status === "cancelled") {
    return { id: runId, spec, status: "cancelled", startedAt, finishedAt };
  }
  if (job.status === "failed") {
    return {
      id: runId,
      spec,
      status: "failed",
      startedAt,
      finishedAt,
      error: job.error ?? "빌드 잡이 실패했습니다.",
    };
  }
  const response = job.response;
  // 성공 잡의 최종 build 응답이 부분 실패(status: "failed", 502와 동일한 wire)일 수
  // 있다 — terminal failure와 partial-result를 구분해 그대로 노출한다.
  if (response && response.status !== "ok") {
    return {
      id: runId,
      spec,
      status: "failed",
      startedAt,
      finishedAt,
      error: "일부 소스 빌드가 실패했습니다.",
    };
  }
  return { id: runId, spec, status: "succeeded", startedAt, finishedAt };
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
export function mockBuilds(): BuildRun[] {
  return DEMO_DATASETS.map((dataset) => ({
    id: dataset.buildId,
    spec: mockSpec(dataset),
    status: dataset.status,
    startedAt: dataset.startedAt,
    finishedAt: dataset.finishedAt,
  }));
}

/**
 * 빌드 실행 이력 목록을 조회한다 (#12, #95, #153).
 *
 * mock 모드(`VITE_USE_REAL_BUILDER` 미설정)에서는 이력 표/검색/정렬 UI를 개발·검증할 수
 * 있도록 결정적 mock 목록을 반환한다.
 *
 * 실연동 모드에서는 Builder `GET /builds`를 호출하고 응답을 BuildListItem[]으로 매핑한다(#153, builder #250).
 * Builder 응답에 spec/title이 없으므로 title은 null이 되고, UI는 run ID를 대신 표시한다.
 *
 * @param limit - 선택적 limit 파라미터. Builder의 기본값(50)을 사용하려면 생략한다.
 * @returns 빌드 실행 목록(mock 모드: 결정적 mock, 실연동 모드: Builder 응답 매핑).
 */
export async function listBuilds(limit?: number): Promise<BuildListItem[]> {
  if (!isRealBuilderEnabled()) {
    return mockBuilds().map((run) => ({
      id: run.id,
      title: run.spec.title,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
    }));
  }

  const response = await builderApi.listBuilds(limit);
  return response.builds.map((summary) => ({
    id: summary.run_id,
    title: null, // Builder GET /builds는 title을 제공하지 않음
    status: summary.status === "ok" ? "succeeded" : "failed",
    startedAt: summary.started_at ?? null, // 누락 또는 null을 명시적 null로 정규화
    finishedAt: summary.finished_at ?? null, // 누락 또는 null을 명시적 null로 정규화
  }));
}

