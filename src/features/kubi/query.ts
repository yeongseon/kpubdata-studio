/**
 * Generated SQL 실행 — Builder `/query` 호출 래퍼 (#256, Builder #504 contract 1.7.0).
 *
 * SQL은 여기서 자동 실행되지 않는다 — 이 함수는 사용자가 명시적으로 "실행" 버튼을 눌렀을 때만
 * `useKubiSession`에서 호출된다. Bronze 실행은 Builder도 거부하지만, 요청 자체를 보내지 않도록
 * UI 단에서 먼저 차단한다(불필요한 401/403 왕복과 "혹시 되나?" 재시도를 줄인다).
 *
 * 최종 SQL 안전성 검사(mutation/filesystem/network 차단, CTE shadowing 등)는 Builder가
 * 담당한다 — Studio는 여기서 SQL 내용을 파싱하거나 재검증하지 않는다.
 */
import { ApiError, builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";
import { queryErrorResponseSchema } from "@/shared/lib/builderApi.schema";
import type { KubiContext, KubiGeneratedSql, KubiQueryState } from "./types";

/**
 * 현재 context에서 Generated SQL을 실행할 수 있는지 판단한다.
 *
 * @param context - 실행을 시도하는 시점의 KubiContext(stale guard 통과 후 값이어야 한다).
 * @param sql - 실행 대상 Generated SQL.
 * @returns 실행 가능하면 null, 불가능하면 사용자에게 보여줄 사유.
 */
export function blockedReason(context: KubiContext, sql: KubiGeneratedSql): string | null {
  if (context.stage === "bronze") {
    return "Bronze 문맥에서는 SQL을 실행할 수 없습니다. Silver 또는 Gold에서만 실행할 수 있습니다.";
  }
  if (context.stage !== sql.stage) {
    return `현재 화면 stage(${context.stage ?? "없음"})와 Generated SQL의 stage(${sql.stage})가 다릅니다.`;
  }
  if (!context.datasetId || !context.runId) {
    return "실행하려면 dataset와 run이 모두 선택되어 있어야 합니다.";
  }
  return null;
}

function classifyError(cause: unknown): KubiQueryState {
  if (cause instanceof ApiError) {
    const parsed = queryErrorResponseSchema.safeParse(cause.details);
    if (parsed.success && parsed.data.code) {
      return { status: "error", code: parsed.data.code, message: parsed.data.error };
    }
    if (cause.status === 0) return { status: "error", code: "network", message: cause.message };
    return { status: "error", code: "unknown", message: cause.message };
  }
  if (cause instanceof DOMException && cause.name === "AbortError") {
    return { status: "error", code: "unknown", message: "요청이 취소되었습니다." };
  }
  return {
    status: "error",
    code: "unknown",
    message: cause instanceof Error ? cause.message : "Query 실행 중 알 수 없는 오류가 발생했습니다.",
  };
}

/**
 * Builder `/query`를 호출해 Generated SQL을 실행한다.
 *
 * @param context - 실행 시점 KubiContext(datasetId/runId/stage 필요).
 * @param sql - 실행 대상 Generated SQL(사용자가 확인/수정했을 수 있는 최종 텍스트).
 * @param signal - 취소 signal.
 * @returns 실행 결과 상태(성공/오류가 구조화되어 있으며, 실패해도 예외를 던지지 않는다).
 */
export async function runKubiQuery(
  context: KubiContext,
  sql: KubiGeneratedSql,
  signal?: AbortSignal,
): Promise<KubiQueryState> {
  const blocked = blockedReason(context, sql);
  if (blocked) return { status: "blocked", reason: blocked };

  if (!isRealBuilderEnabled()) {
    return {
      status: "error",
      code: "mock_mode",
      message: "mock 모드에서는 Query 실행을 지원하지 않습니다. VITE_USE_REAL_BUILDER=true로 실제 Builder에 연결하세요.",
    };
  }

  try {
    const result = await builderApi.query(
      {
        dataset_id: context.datasetId!,
        run_id: context.runId!,
        stage: sql.stage,
        sql: sql.sql,
        ...(sql.source ? { source: sql.source } : {}),
      },
      signal,
    );
    return { status: "success", result };
  } catch (cause) {
    return classifyError(cause);
  }
}
