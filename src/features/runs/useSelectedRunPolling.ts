/**
 * 선택된 Run의 실시간(비동기 job) 상태를 지켜보는 훅 (#255).
 *
 * `GET /builds/{run_id}`는 in-memory active job registry 기반이라(#245, builder
 * #480/#482) 이미 종료되어 registry에서 빠진 run은 404를 반환한다 — 그 경우
 * "not_in_registry"로 명시하고, run의 historical 상태(목록/stage summary)를
 * 대신 신뢰해야 한다는 신호를 준다. 새 폴링 state machine을 만들지 않고 기존
 * #245 loop(`pollBuildJobUntilTerminal`)을 그대로 재사용한다.
 *
 * 403은 404와 다른 신호다(#255 P0) — "registry에 없음"이 아니라 "조회할 권한이
 * 없음"이므로 별도 kind로 구분하고, historical 상태로 조용히 fallback하지 않는다.
 */
import { useEffect, useState } from "react";
import { pollBuildJobUntilTerminal } from "@/features/runs/api";
import { classifyRunApiError } from "@/features/runs/model";
import { builderApi, type BuildJob } from "@/shared/lib/builderApi";

export type SelectedRunLiveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "job"; job: BuildJob }
  | { kind: "not_in_registry" }
  | { kind: "permission_denied" }
  | { kind: "error"; message: string };

/**
 * @param runId - 지켜볼 run id. null이면 polling하지 않는다.
 * @returns 최신 async job 상태(존재하면). registry에 없으면 historical 데이터를 쓰라는 신호.
 */
export function useSelectedRunPolling(runId: string | null): SelectedRunLiveState {
  const [state, setState] = useState<SelectedRunLiveState>({ kind: "idle" });

  useEffect(() => {
    if (!runId) {
      setState({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });

    async function run() {
      try {
        const job = await builderApi.getBuildJob(runId!, controller.signal);
        if (cancelled) return;
        setState({ kind: "job", job });
        if (job.status === "queued" || job.status === "running" || job.status === "cancelling") {
          await pollBuildJobUntilTerminal(runId!, job, controller.signal, (polled) => {
            if (!cancelled) setState({ kind: "job", job: polled });
          });
        }
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        const kind = classifyRunApiError(cause);
        if (kind === "not_found") {
          setState({ kind: "not_in_registry" });
          return;
        }
        if (kind === "permission_denied") {
          setState({ kind: "permission_denied" });
          return;
        }
        // 일시적 network/서버 오류다 — 이전에 확인한 상태를 "실패"로 바꾸지 않고
        // 별도 error 신호만 노출한다(#255 §10 polling lifecycle 요구사항).
        setState({
          kind: "error",
          message: cause instanceof Error ? cause.message : "run 상태를 갱신하지 못했습니다.",
        });
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runId]);

  return state;
}
