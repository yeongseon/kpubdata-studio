/**
 * 공통 Stepper 컴포넌트.
 *
 * New Build Wizard처럼 다단계 흐름의 진행 상태를 표시한다. 각 단계는
 * upcoming/current/complete/error 상태를 가지며, 현재 단계에 aria-current="step"을
 * 부여해 보조기기에서 위치를 알 수 있게 한다(접근성, 제안 §12).
 */
import { cn } from "./cn";

export type StepState = "upcoming" | "current" | "complete" | "error";

export interface StepItem {
  /** 단계 식별자 */
  id: string;
  /** 단계 라벨(한국어) */
  label: string;
}

export interface StepperProps {
  /** 표시할 단계 목록(순서대로) */
  steps: StepItem[];
  /** 현재 활성 단계의 0-기반 인덱스 */
  current: number;
  /** 오류가 발생한 단계 인덱스 집합(선택) */
  errorSteps?: number[];
  /** 단계 클릭으로 이동 허용 시 핸들러(완료된 단계만 이동 가능) */
  onStepClick?: (index: number) => void;
  /** 추가 className */
  className?: string;
}

function resolveState(index: number, current: number, errorSteps: number[]): StepState {
  if (errorSteps.includes(index)) return "error";
  if (index < current) return "complete";
  if (index === current) return "current";
  return "upcoming";
}

const STATE_CIRCLE: Record<StepState, string> = {
  upcoming: "border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500",
  current: "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900",
  complete: "border-emerald-600 bg-emerald-600 text-white",
  error: "border-red-600 bg-red-600 text-white",
};

/**
 * 다단계 흐름의 진행 상태를 가로 스텝 표시기로 렌더링한다.
 *
 * @param props - steps/current/errorSteps/onStepClick.
 * @returns 스텝퍼 엘리먼트.
 */
export function Stepper({
  steps,
  current,
  errorSteps = [],
  onStepClick,
  className,
}: StepperProps) {
  return (
    <ol className={cn("flex w-full items-center gap-2 overflow-x-auto", className)}>
      {steps.map((step, index) => {
        const state = resolveState(index, current, errorSteps);
        const clickable = Boolean(onStepClick) && index < current;
        const circle = (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              STATE_CIRCLE[state],
            )}
            aria-hidden="true"
          >
            {state === "complete" ? "✓" : state === "error" ? "!" : index + 1}
          </span>
        );

        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-fit items-center gap-2"
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                {circle}
                <span className="whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {step.label}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {circle}
                <span
                  className={cn(
                    "whitespace-nowrap text-sm font-medium",
                    state === "upcoming"
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-700 dark:text-zinc-200",
                  )}
                >
                  {step.label}
                </span>
              </div>
            )}
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
