import { useEffect, useState } from "react";
import { listBuildStages } from "@/features/datasets/api";

/** 현재 live Run에서 Builder가 확인한 source_key만 제공한다. */
export function useLiveRunSources(runId?: string): string[] {
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    // 이전 Run의 source가 새 Run의 조회 동안 잠시 노출되지 않게 즉시 비운다.
    setSources([]);
    if (!runId) return () => controller.abort();

    void listBuildStages(runId, controller.signal)
      .then((response) => {
        if (!current || controller.signal.aborted || response.run_id !== runId) return;
        setSources([...new Set(response.sources.map((source) => source.source_key))]);
      })
      .catch(() => {
        // 조회 실패는 source 부재/후보 추측으로 바꾸지 않는다. picker 후보를 비워 둔다.
        if (current && !controller.signal.aborted) setSources([]);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [runId]);

  return sources;
}
