/**
 * 게시(publish) 작업을 상태 머신으로 관리하는 훅 (#9).
 *
 * idle → publishing → published/failed/cancelled. 취소(AbortController)를 지원하며,
 * Builder publish 엔드포인트가 비동기로 바뀌면 이 훅 내부만 폴링으로 확장한다.
 */
import { useCallback, useRef, useState } from "react";
import { publishBuild, type PublishDestination, type PublishResult } from "@/features/publish/api";

export type PublishJobStatus = "idle" | "publishing" | "published" | "failed" | "cancelled";

export interface PublishJob {
  status: PublishJobStatus;
  result?: PublishResult;
  error?: string;
  start: (buildId: string, destination: PublishDestination) => Promise<void>;
  cancel: () => void;
}

/**
 * 게시 상태와 제어(start/cancel)를 제공하는 훅.
 *
 * @returns PublishJob 상태와 제어 함수.
 */
export function usePublishJob(): PublishJob {
  const [status, setStatus] = useState<PublishJobStatus>("idle");
  const [result, setResult] = useState<PublishResult>();
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (buildId: string, destination: PublishDestination) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("publishing");
    setError(undefined);
    setResult(undefined);
    try {
      const res = await publishBuild(buildId, destination, controller.signal);
      if (controller.signal.aborted) return;
      setResult(res);
      setStatus(res.status === "published" ? "published" : "failed");
      if (res.status !== "published") setError(res.error ?? "게시에 실패했습니다.");
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        return;
      }
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "게시에 실패했습니다.");
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus((current) => (current === "publishing" ? "cancelled" : current));
  }, []);

  return { status, result, error, start, cancel };
}
