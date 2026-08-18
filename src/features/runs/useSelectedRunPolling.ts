/**
 * 선택된 Run의 실시간(비동기 job) 상태를 지켜보는 훅 (#255).
 *
 * `GET /builds/{run_id}`는 in-memory active job registry 기반이라(#245, builder
 * #480/#482) 이미 종료되어 registry에서 빠진 run은 404를 반환한다 — 그 경우
 * "not_in_registry"로 명시하고, run의 historical 상태(목록/stage summary)를
 * 대신 신뢰해야 한다는 신호를 준다.
 *
 * 403은 404와 다른 신호다(#255 P0) — "registry에 없음"이 아니라 "조회할 권한이
 * 없음"이므로 별도 kind로 구분하고, historical 상태로 조용히 fallback하지 않는다.
 *
 * visibility-aware polling(#255 §3): run이 선택되거나 바뀌면 항상 즉시 한 번 조회하고,
 * 그 뒤 non-terminal job을 계속 지켜봐야 할 때만 `useVisibilityAwarePolling`을 공유해
 * interval polling을 잇는다 — 새 scheduler를 만들지 않는다. tab이 hidden이면 interval
 * tick이 새 request를 시작하지 않고, visible로 돌아오면 즉시 한 번 refresh한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isTerminalBuilderStatus, POLL_INTERVAL_MS } from "@/features/runs/api";
import { classifyRunApiError } from "@/features/runs/model";
import { useVisibilityAwarePolling } from "./useVisibilityAwarePolling";
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
  const controllerRef = useRef<AbortController | null>(null);

  // 항상 최신 run_id를 조회한다 — run 변경 시 이전 request는 abort하고, 늦게 도착한 이전
  // run의 응답이 새 selection을 덮어쓰지 않도록 abort된 signal의 응답은 무시한다.
  const fetchNow = useCallback(async () => {
    if (!runId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const job = await builderApi.getBuildJob(runId, controller.signal);
      if (controller.signal.aborted) return;
      setState({ kind: "job", job });
    } catch (cause) {
      if (controller.signal.aborted) return;
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
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      controllerRef.current?.abort();
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    void fetchNow();
    return () => {
      controllerRef.current?.abort();
    };
    // fetchNow는 runId에서만 파생되므로(useCallback deps: [runId]) runId만으로 충분하다.
  }, [runId]);

  // interval polling은 첫 조회가 실제로 non-terminal job임을 확인한 뒤에만 시작한다
  // (#245 원 동작과 동일) — 아직 "loading"인 동안에는 interval을 잡지 않는다. 최초 1회
  // 조회는 위 effect가 항상 즉시 수행하므로 이 게이팅으로 초기 조회가 늦어지지 않는다.
  const nonTerminal = state.kind === "job" && !isTerminalBuilderStatus(state.job.status);
  const pollingEnabled = Boolean(runId) && nonTerminal;

  useVisibilityAwarePolling(() => void fetchNow(), POLL_INTERVAL_MS, pollingEnabled);

  return state;
}
