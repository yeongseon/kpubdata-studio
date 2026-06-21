/**
 * 빌드 실행을 비동기 job으로 관리하는 훅 (#39).
 *
 * idle → running → succeeded/failed/cancelled 상태 머신과 취소(AbortController)를
 * 제공한다. Builder의 /build가 동기식인 현재는 단일 호출을 감싸지만, Builder에 job
 * 제출/폴링 엔드포인트가 생기면 이 훅 내부만 폴링으로 확장하면 된다(호출부 변경 없음).
 */
import { useCallback, useRef, useState } from "react";
import { executeBuild } from "@/features/runs/api";
import { ApiError } from "@/shared/lib/builderApi";
import type { BuildRun, BuildSpec } from "@/shared/lib/types";

export type BuildJobStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export interface BuildJob {
  /** 현재 job 상태 */
  status: BuildJobStatus;
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
  const [run, setRun] = useState<BuildRun>();
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (spec: BuildSpec) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("running");
    setError(undefined);
    setRun(undefined);
    try {
      const result = await executeBuild(spec, controller.signal);
      if (controller.signal.aborted) return;
      setRun(result);
      setStatus(result.status === "succeeded" ? "succeeded" : "failed");
      if (result.status !== "succeeded") setError("일부 소스 빌드가 실패했습니다.");
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        return;
      }
      setStatus("failed");
      setError(cause instanceof ApiError ? cause.message : "빌드 실행에 실패했습니다.");
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus((current) => (current === "running" ? "cancelled" : current));
  }, []);

  return { status, run, error, start, cancel };
}
