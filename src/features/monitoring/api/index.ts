/**
 * Monitoring API 클라이언트 (#264).
 *
 * Builder #516 시스템/집계 monitoring API와 통신합니다.
 * 실연동 모드와 mock 모드를 모두 지원합니다.
 */
import { apiFetch, isRealBuilderEnabled, type ApiError } from "@/shared/lib/builderApi";
import {
  buildStatsSchema,
  monitoringResponseSchema,
  systemResourceSchema,
} from "./types";
import type {
  BuildStats,
  MonitoringAvailability,
  MonitoringResponse,
  RecentBuilds,
  SystemResource,
} from "./types";

export type { BuildStats, MonitoringAvailability, MonitoringResponse, RecentBuilds, SystemResource } from "./types";

/**
 * 시스템 리소스 상태를 조회합니다 (#264).
 *
 * @param signal - 취소용 AbortSignal (선택).
 * @returns 시스템 리소스 상태.
 * @throws ApiError - API 요청이 실패한 경우.
 */
export async function getSystemResources(signal?: AbortSignal): Promise<SystemResource> {
  if (!isRealBuilderEnabled()) {
    return mockSystemResources();
  }

  // 실연동 모드에서 Builder API 호출
  // Builder #516 endpoint 형태: GET /monitoring/system
  return apiFetch<SystemResource>(
    "/monitoring/system",
    { signal, skipAuth: false },
    systemResourceSchema,
  );
}

/**
 * 빌드 통계를 조회합니다 (#264).
 *
 * @param limit - 조회할 시간대 수 (선택).
 * @param signal - 취소용 AbortSignal (선택).
 * @returns 빌드 통계.
 * @throws ApiError - API 요청이 실패한 경우.
 */
export async function getBuildStats(limit?: number, signal?: AbortSignal): Promise<BuildStats> {
  if (!isRealBuilderEnabled()) {
    return mockBuildStats();
  }

  const query = limit !== undefined ? `?limit=${limit}` : "";
  // Builder #516 endpoint 형태: GET /monitoring/build-stats?limit=N
  return apiFetch<BuildStats>(
    `/monitoring/build-stats${query}`,
    { signal, skipAuth: false },
    buildStatsSchema,
  );
}

/**
 * 전체 monitoring 데이터를 조회합니다 (#264).
 *
 * @param signal - 취소용 AbortSignal (선택).
 * @returns monitoring 응답.
 * @throws ApiError - API 요청이 실패한 경우.
 */
export async function getMonitoringData(signal?: AbortSignal): Promise<MonitoringResponse> {
  if (!isRealBuilderEnabled()) {
    return mockMonitoringData();
  }

  // Builder #516 endpoint 형태: GET /monitoring
  return apiFetch<MonitoringResponse>(
    "/monitoring",
    { signal, skipAuth: false },
    monitoringResponseSchema,
  );
}

/**
 * 최근 빌드 목록을 조회합니다 (#264).
 *
 * Build 화면으로 네비게이션하기 위한 최근 빌드 정보입니다.
 *
 * @param limit - 조회할 빌드 수 (선택, 기본값 10).
 * @param signal - 취소용 AbortSignal (선택).
 * @returns 최근 빌드 목록.
 * @throws ApiError - API 요청이 실패한 경우.
 */
export async function getRecentBuilds(limit = 10, signal?: AbortSignal): Promise<RecentBuilds> {
  if (!isRealBuilderEnabled()) {
    return mockRecentBuilds();
  }

  const query = `?limit=${limit}`;
  // 기존 GET /builds endpoint 재사용
  const response = await apiFetch<{ builds: Array<{
    run_id: string;
    status: "ok" | "failed" | "cancelled";
    started_at: string | null;
    finished_at: string | null;
  }> }>(
    `/builds${query}`,
    { signal, skipAuth: false },
  );

  return {
    builds: response.builds.map(build => ({
      run_id: build.run_id,
      status: build.status,
      started_at: build.started_at,
      finished_at: build.finished_at,
      dataset_id: null, // 기존 API는 dataset_id를 제공하지 않음
    })),
  };
}

/**
 * Monitoring 데이터 가용성을 확인합니다 (#264).
 *
 * @param signal - 취소용 AbortSignal (선택).
 * @returns 데이터 가용성 상태.
 */
export async function checkMonitoringAvailability(
  signal?: AbortSignal,
): Promise<MonitoringAvailability> {
  if (!isRealBuilderEnabled()) {
    return "available";
  }

  try {
    const response = await apiFetch<{ availability: MonitoringAvailability }>(
      "/monitoring/availability",
      { signal, skipAuth: false },
    );
    return response.availability;
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.status === 401 || apiError.status === 403) {
      return "unavailable";
    }
    if (apiError.status === 503) {
      return "partial";
    }
    return "unavailable";
  }
}

// ===== Mock 데이터 =====

const MOCK_TIME = new Date().toISOString();

function mockSystemResources(): SystemResource {
  return {
    health: "healthy",
    p95_latency: 150,
    queue: {
      queued: 2,
      running: 3,
      total: 5,
    },
    workers: {
      active: 3,
      capacity: 10,
      utilization: 0.3,
    },
    artifact_store: {
      status: "available",
      last_write: MOCK_TIME,
    },
    provider_status: {
      datago: "available",
      seoul: "degraded",
    },
  };
}

function mockBuildStats(): BuildStats {
  const now = new Date();
  const entries: Array<{
    timestamp: string;
    success_count: number;
    fail_count: number;
    cancelled_count: number;
    total_count: number;
  }> = [];

  // 최근 24시간 데이터 생성 (1시간 간격)
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
    const success = Math.floor(Math.random() * 5);
    const fail = Math.floor(Math.random() * 2);
    const cancelled = Math.floor(Math.random() * 1);
    
    entries.push({
      timestamp,
      success_count: success,
      fail_count: fail,
      cancelled_count: cancelled,
      total_count: success + fail + cancelled,
    });
  }

  const totalSuccess = entries.reduce((sum, entry) => sum + entry.success_count, 0);
  const totalFail = entries.reduce((sum, entry) => sum + entry.fail_count, 0);
  const totalCancelled = entries.reduce((sum, entry) => sum + entry.cancelled_count, 0);

  return {
    entries,
    summary: {
      success_count: totalSuccess,
      fail_count: totalFail,
      cancelled_count: totalCancelled,
      total_count: totalSuccess + totalFail + totalCancelled,
    },
  };
}

function mockMonitoringData(): MonitoringResponse {
  return {
    system: mockSystemResources(),
    build_stats: mockBuildStats(),
    availability: "available",
    last_updated: MOCK_TIME,
  };
}

function mockRecentBuilds(): RecentBuilds {
  const now = new Date();
  const builds: Array<{
    run_id: string;
    status: "ok" | "failed" | "cancelled";
    started_at: string | null;
    finished_at: string | null;
    dataset_id: string | null;
  }> = [];

  const statuses: Array<"ok" | "failed" | "cancelled"> = ["ok", "ok", "ok", "failed", "cancelled"];
  
  for (let i = 0; i < 10; i++) {
    const startedAt = new Date(now.getTime() - i * 30 * 60 * 1000).toISOString();
    const finishedAt = new Date(now.getTime() - (i * 30 * 60 * 1000) + (15 * 60 * 1000)).toISOString();
    
    builds.push({
      run_id: `build-${Date.now() - i * 10000}`,
      status: statuses[i % statuses.length],
      started_at: startedAt,
      finished_at: finishedAt,
      dataset_id: `dataset-${i}`,
    });
  }

  return { builds };
}