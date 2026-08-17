/**
 * Monitoring API 타입 및 스키마 (#264).
 *
 * Builder #516 시스템/집계 monitoring API의 응답 스키마와 타입 정의입니다.
 */

import { z } from "zod";

/**
 * 시스템 리소스 스키마 (#264).
 *
 * Builder API health, queue status, workers, artifact store 상태를 포함합니다.
 */
export const systemResourceSchema = z.object({
  /** Builder API health 상태 */
  health: z.enum(["healthy", "degraded", "unavailable"]),
  /** p95 지연 시간 (ms) */
  p95_latency: z.number().nonnegative().nullable(),
  /** 큐 상태 */
  queue: z.object({
    queued: z.number().nonnegative(),
    running: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  /** 워커 상태 */
  workers: z.object({
    active: z.number().nonnegative(),
    capacity: z.number().nonnegative(),
    utilization: z.number().min(0).max(1),
  }),
  /** Artifact Store 상태 */
  artifact_store: z.object({
    status: z.enum(["available", "unavailable", "degraded"]),
    last_write: z.string().nullable(),
  }),
  /** Provider 상태 (optional) */
  provider_status: z.record(z.string(), z.enum(["available", "unavailable", "degraded"])).optional(),
});

/**
 * Build 통계 스키마 (#264).
 *
 * 시간대별 build 수와 상태별 카운트를 포함합니다.
 */
export const buildStatsEntrySchema = z.object({
  /** 시간대 (ISO 8601 timestamp) */
  timestamp: z.string(),
  /** 성공한 빌드 수 */
  success_count: z.number().nonnegative(),
  /** 실패한 빌드 수 */
  fail_count: z.number().nonnegative(),
  /** 취소된 빌드 수 */
  cancelled_count: z.number().nonnegative(),
  /** 전체 빌드 수 */
  total_count: z.number().nonnegative(),
});

export const buildStatsSchema = z.object({
  /** 시간대별 빌드 통계 */
  entries: z.array(buildStatsEntrySchema),
  /** 기간 내 전체 통계 */
  summary: z.object({
    success_count: z.number().nonnegative(),
    fail_count: z.number().nonnegative(),
    cancelled_count: z.number().nonnegative(),
    total_count: z.number().nonnegative(),
  }),
});

/**
 * Monitoring 응답 스키마 (#264).
 *
 * 시스템 리소스와 빌드 통계를 포함하는 전체 응답입니다.
 */
export const monitoringResponseSchema = z.object({
  /** 시스템 리소스 상태 */
  system: systemResourceSchema,
  /** 빌드 통계 */
  build_stats: buildStatsSchema,
  /** 데이터 가용성 */
  availability: z.enum(["available", "partial", "unavailable"]),
  /** 마지막 업데이트 시간 */
  last_updated: z.string(),
});

/**
 * 최근 빌드 요약 스키마 (#264).
 *
 * Build 화면으로 네비게이션하기 위한 최근 빌드 정보입니다.
 */
export const recentBuildSchema = z.object({
  /** 빌드 실행 ID */
  run_id: z.string(),
  /** 빌드 상태 */
  status: z.enum(["ok", "failed", "cancelled"]),
  /** 시작 시간 */
  started_at: z.string().nullable(),
  /** 완료 시간 */
  finished_at: z.string().nullable(),
  /** 데이터셋 ID (optional) */
  dataset_id: z.string().nullable(),
});

export const recentBuildsSchema = z.object({
  builds: z.array(recentBuildSchema),
});

/**
 * 타입 추출
 */
export type SystemResource = z.infer<typeof systemResourceSchema>;
export type BuildStatsEntry = z.infer<typeof buildStatsEntrySchema>;
export type BuildStats = z.infer<typeof buildStatsSchema>;
export type MonitoringResponse = z.infer<typeof monitoringResponseSchema>;
export type RecentBuild = z.infer<typeof recentBuildSchema>;
export type RecentBuilds = z.infer<typeof recentBuildsSchema>;

/**
 * 데이터 가용성
 */
export type MonitoringAvailability = "available" | "partial" | "unavailable";

/**
 * 시스템 상태
 */
export type SystemHealth = "healthy" | "degraded" | "unavailable";