import { useCallback, useEffect, useRef, useState } from "react";
import {
  describePublishFailure,
  publishBuild,
  type PublishFailure,
  type PublishRequest,
  type PublishResponse,
} from "@/features/publish/api";

export type PublishJobStatus = "idle" | "publishing" | "published" | "failed" | "aborted";

export interface PublishJob {
  status: PublishJobStatus;
  result?: PublishResponse;
  failure?: PublishFailure;
  start: (runId: string, request: PublishRequest) => Promise<void>;
  stopWaiting: () => void;
  reset: () => void;
}

export function usePublishJob(): PublishJob {
  const [status, setStatus] = useState<PublishJobStatus>("idle");
  const [result, setResult] = useState<PublishResponse>();
  const [failure, setFailure] = useState<PublishFailure>();
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const operationRef = useRef(0);

  const start = useCallback(async (runId: string, request: PublishRequest) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const operation = ++operationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("publishing");
    setFailure(undefined);
    setResult(undefined);
    try {
      const response = await publishBuild(runId, request, controller.signal);
      if (controller.signal.aborted || operation !== operationRef.current) return;
      if (response.run_id !== runId || response.target !== request.target) {
        setStatus("failed");
        setFailure({ kind: "unknown", message: "Builder 응답의 Run 또는 target이 요청과 일치하지 않습니다." });
        return;
      }
      setResult(response);
      setStatus("published");
    } catch (cause) {
      if (operation !== operationRef.current) return;
      if (controller.signal.aborted) {
        setStatus("aborted");
        return;
      }
      setStatus("failed");
      setFailure(describePublishFailure(cause));
    } finally {
      if (operation === operationRef.current) {
        if (controllerRef.current === controller) controllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, []);

  const stopWaiting = useCallback(() => {
    controllerRef.current?.abort();
    setStatus((current) => current === "publishing" ? "aborted" : current);
  }, []);

  const reset = useCallback(() => {
    operationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    setStatus("idle");
    setResult(undefined);
    setFailure(undefined);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { status, result, failure, start, stopWaiting, reset };
}
