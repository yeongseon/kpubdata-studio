/**
 * 빌드 실행을 비동기 job으로 관리하는 훅 (#39).
 *
 * idle → running → succeeded/failed/cancelled 상태 머신과 취소(AbortController)를
 * 제공한다. 실연동 모드에서는 Builder 비동기 job 표면(POST /builds + GET
 * /builds/{run_id} 폴링, builder #480/#482)을 사용하고, 폴링 중인 잡의 wire
 * 상태(queued/running/...)를 builderStatus로 노출한다(#245).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { executeBuild, type BuilderJobStatus } from "@/features/runs/api";
import { ApiError, extractErrorMessage } from "@/shared/lib/builderApi";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

export type BuildJobStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export interface BuildJob {
  /** 현재 job 상태 */
  status: BuildJobStatus;
  /** Builder 잡의 최신 wire 상태(queued/running/cancelling — 실연동 폴링 중) */
  builderStatus?: BuilderJobStatus;
  /** 완료된 실행 결과(성공/실패 시) */
  run?: BuildRun;
  /** 실패 시 오류 메시지 */
  error?: string;
  /** 빌드 실행을 시작한다. */
  start: (spec: BuildSpec) => Promise<void>;
  /** 진행 중인 실행을 취소한다. */
  cancel: () => void;
}

/**
 * 빌드 실행 job 상태와 제어(start/cancel)를 제공하는 훅.
 *
 * @returns BuildJob 상태와 제어 함수.
 */
export function useBuildJob(): BuildJob {
  const [status, setStatus] = useState<BuildJobStatus>("idle");
  const [builderStatus, setBuilderStatus] = useState<BuilderJobStatus>();
  const [run, setRun] = useState<BuildRun>();
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (spec: BuildSpec) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("running");
    setBuilderStatus(undefined);
    setError(undefined);
    setRun(undefined);
    try {
      const result = await executeBuild(spec, controller.signal, (jobStatus) => {
        if (!controller.signal.aborted) setBuilderStatus(jobStatus);
      });
      if (controller.signal.aborted) return;
      setRun(result);
      setStatus(result.status === "succeeded" ? "succeeded" : "failed");
      if (result.status !== "succeeded") setError(result.error ?? "일부 소스 빌드가 실패했습니다.");
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        return;
      }
      setStatus("failed");
      // /build 502는 최상위 error 없이 outcomes[].error로 실패 사유를 돌려준다.
      // 우선순위: 최상위 error(하위 호환) → outcomes[].error → ApiError 메시지 → 일반 메시지.
      const message =
        cause instanceof ApiError
          ? (extractErrorMessage(cause.details) ?? cause.message)
          : "빌드 실행에 실패했습니다.";
      setError(message);
    } finally {
      // 실행이 끝나면(성공/실패/취소) 더 이상 유효하지 않은 컨트롤러 참조를 정리한다.
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus((current) => (current === "running" ? "cancelled" : current));
  }, []);

  // 언마운트 시 진행 중인 실행을 중단해 unmount 이후 setState를 방지한다(#73).
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { status, builderStatus, run, error, start, cancel };
}
