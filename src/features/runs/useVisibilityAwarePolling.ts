/**
 * visibility-aware 반복 실행 헬퍼 (#255 §3).
 *
 * Selected Run status polling(`useSelectedRunPolling`)과 structured Run event
 * polling(`useRunEvents`)이 각자 새 scheduler를 만들지 않고 공유하는 최소 primitive다.
 * 새로운 request를 시작할지 말지만 결정할 뿐, run 상태 판정 로직은 전혀 모른다.
 *
 * 정책:
 * - `document.visibilityState === "hidden"`이면 interval tick에서 콜백을 호출하지 않는다
 *   (=새 polling request를 만들지 않는다). 이미 진행 중인 요청은 이 훅이 건드리지 않는다 —
 *   abort/취소는 호출부(각 훅)의 몫이다.
 * - `hidden → visible` 전환 시 콜백을 즉시 한 번 호출하고, 그 시점부터 interval을 다시 잰다
 *   (전환 직후 곧바로 중복 tick이 겹치지 않도록).
 * - `enabled=false`(예: terminal 상태)면 아무 것도 예약하지 않는다.
 */
import { useEffect, useRef } from "react";

export type VisibilityPollReason = "interval" | "visible-resume";

/**
 * @param tick - 실행할 콜백(보통 최신 상태를 한 번 조회하는 함수). 매 렌더마다 새로 만들어도 안전하다.
 * @param intervalMs - polling 간격(ms).
 * @param enabled - false면 어떤 tick도 예약/발생시키지 않는다(terminal 상태 등).
 */
export function useVisibilityAwarePolling(
  tick: (reason: VisibilityPollReason) => void,
  intervalMs: number,
  enabled: boolean,
): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          tickRef.current("interval");
        }
        // hidden이면 request 없이 다음 체크만 다시 예약한다 — 새 polling request를 만들지 않는다.
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // 복귀 즉시 한 번 refresh하고, 그 시점부터 interval을 다시 잰다(직후 중복 tick 방지).
      tickRef.current("visible-resume");
      scheduleNext();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
