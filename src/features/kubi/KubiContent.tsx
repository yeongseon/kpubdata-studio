/**
 * Kubi 대화 UI (#256).
 *
 * `KubiDrawer`(전역 drawer)와 `/kubi` 전용 페이지가 이 컴포넌트 하나를 공유한다 — 두 번째
 * Kubi 시스템을 만들지 않는다. `compact`는 drawer(좁은 폭)와 페이지(넓은 폭) 레이아웃만
 * 다르게 하고, 상태 로직은 전부 `useKubiSession`에 있다.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpecDiff } from "@/features/build-spec/components/SpecDiff";
import { useAssistConfig } from "@/features/assistant/config";
import { Button, Card } from "@/shared/ui";
import { describeAction } from "./actions";
import { relatedCatalogDatasets } from "./relatedDatasets";
import type { KubiAction } from "./schema";
import { summarizeKubiQuality } from "./types";
import type { KubiActionRunState, KubiContext, KubiErrorState, KubiQueryState, KubiTurn } from "./types";
import { useKubiSession } from "./useKubiSession";

/** 데모 CTA와 onboarding 예시 질문이 함께 쓰는 기본 질문(mock evidence만으로도 답이 나온다). */
const DEMO_QUESTION = "이 데이터셋 품질 어때?";

const SUGGESTED_QUESTIONS = [
  "현재 화면 문맥을 요약해줘.",
  "지금 확인된 Quality 이슈의 원인과 우선순위를 알려줘.",
  "이 Build가 실패했다면 원인을 분석해줘.",
  "이 데이터로 어떤 걸 SQL로 확인할 수 있을지 제안해줘.",
];

/**
 * 프로토타입 구조(DATASET/BUILD(RUN)/STAGE/QUALITY 4칸)를 따르는 context bar (#256 review).
 * PAGE는 프로토타입에서도 별도 grid cell이 아니라 drawer 헤더의 보조 캡션이었으므로, 여기서도
 * 작은 캡션 한 줄로만 표시한다 — 4칸을 차지하지 않는다.
 */
function ContextBar({ context, pageLabel, qualityLabel }: { context: KubiContext; pageLabel: string; qualityLabel: string }) {
  const cells: { label: string; value: string }[] = [
    { label: "DATASET", value: context.datasetId ?? "—" },
    { label: "RUN", value: context.runId ?? "—" },
    { label: "STAGE", value: context.stage ?? "—" },
    { label: "QUALITY", value: qualityLabel },
  ];
  return (
    <div>
      <p className="mb-1.5 text-[10px] text-muted-foreground">현재 화면 · {pageLabel}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{cell.label}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground" title={cell.value}>
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * BYOK(API Key/Model/Base URL) 설정 폼. `KubiContent`(BYOK 미설정 시 기본 노출)와
 * `KubiReportPanel`(#258 — "AI 설정"을 눌렀을 때만 노출)이 이 컴포넌트 하나를 공유한다.
 * 새 BYOK storage/security semantics를 만들지 않는다 — `useAssistConfig`만 그대로 재사용한다.
 */
export function ApiKeySetup() {
  const { apiKey, model, baseUrl, isDefaultBaseUrl, baseUrlSafe, baseUrlError, persistToStorage, setConfig, enablePersistence, disablePersistence } =
    useAssistConfig();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  const [draftBaseUrl, setDraftBaseUrl] = useState(baseUrl);

  return (
    <Card variant="dashed" className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold">Kubi를 사용하려면 LLM API 키가 필요합니다 (BYOK)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          키는 기본적으로 이 브라우저 메모리에만 보관되며, 새로고침하면 사라집니다. Studio는 공용 키를 제공하지
          않습니다.
        </p>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        API Key
        <input
          type="password"
          className="mt-1 h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          placeholder="sk-..."
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted-foreground">
          Model (선택)
          <input
            className="mt-1 h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            value={draftModel}
            onChange={(event) => setDraftModel(event.target.value)}
            placeholder="gpt-4o-mini"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Base URL (선택)
          <input
            className="mt-1 h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            value={draftBaseUrl}
            onChange={(event) => setDraftBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
      </div>
      {!isDefaultBaseUrl ? (
        <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">
          기본 Provider 주소가 아닙니다. 이 주소로 API Key가 전송됩니다: <code>{draftBaseUrl || baseUrl}</code>
        </p>
      ) : null}
      {!baseUrlSafe && baseUrlError ? (
        <p className="text-xs text-red-700 dark:text-red-300" role="alert">
          {baseUrlError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setConfig({ apiKey: draftKey, model: draftModel, baseUrl: draftBaseUrl })} disabled={!draftKey.trim()}>
          저장(이 세션 동안만)
        </Button>
        {persistToStorage ? (
          <Button size="sm" variant="secondary" onClick={disablePersistence}>
            브라우저 저장 해제
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={enablePersistence} disabled={!draftKey.trim()}>
            이 브라우저에 저장(위험 — 경고 표시됨)
          </Button>
        )}
      </div>
    </Card>
  );
}

function ErrorNotice({ error, onRetry }: { error: KubiErrorState; onRetry?: () => void }) {
  const message: Record<KubiErrorState["kind"], string> = {
    no_key: "API Key가 설정되어 있지 않습니다. 위에서 먼저 설정하세요.",
    bad_base_url: (error as Extract<KubiErrorState, { kind: "bad_base_url" }>).message,
    llm_error: (error as Extract<KubiErrorState, { kind: "llm_error" }>).message,
    cancelled: "요청이 취소되었습니다.",
    malformed_output: (error as Extract<KubiErrorState, { kind: "malformed_output" }>).message,
    hallucinated_refs: (error as Extract<KubiErrorState, { kind: "hallucinated_refs" }>).message,
    stale_context: "이 답변은 이전 화면 기준입니다.",
  };
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      {message[error.kind]}
      {onRetry ? (
        <Button className="ml-2" size="sm" variant="ghost" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}

const QUERY_ERROR_LABEL: Record<string, string> = {
  unsafe_query: "SQL 구문 오류 또는 허용되지 않은 쿼리입니다.",
  forbidden: "이 dataset/run에 대한 접근 권한이 없습니다.",
  artifact_unavailable: "요청한 stage 산출물을 아직 사용할 수 없습니다.",
  invalid_context: "dataset/run/stage 문맥이 올바르지 않습니다.",
  invalid_request: "요청 형식이 올바르지 않습니다.",
  query_busy: "Query 처리 용량이 가득 찼습니다. 잠시 후 다시 시도하세요.",
  query_timeout: "Query 실행이 시간 초과되었습니다.",
  query_execution_failed: "Query 실행 중 오류가 발생했습니다.",
  network: "Builder에 연결하지 못했습니다.",
  mock_mode: "mock 모드에서는 Query를 실행할 수 없습니다.",
  unknown: "알 수 없는 오류가 발생했습니다.",
};

/**
 * `/query` row 값을 표시용 문자열로 바꾼다(#256 review §1).
 *
 * null/undefined는 기존처럼 "—"로, 문자열/숫자/불리언 같은 primitive는 그대로 보여준다.
 * array/object는 `String()`이 "[object Object]"를 만들어버리므로 `JSON.stringify`로 실제
 * 내용을 보여준다 — 값 자체를 요약하거나 변형하지 않는다.
 */
export function formatQueryValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function QueryResultView({ query }: { query: KubiQueryState }) {
  if (query.status === "idle") return null;
  if (query.status === "blocked") {
    return <p className="mt-2 text-xs text-muted-foreground">{query.reason}</p>;
  }
  if (query.status === "running") {
    return <p className="mt-2 text-xs text-muted-foreground">Query 실행 중…</p>;
  }
  if (query.status === "error") {
    return (
      <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
        {QUERY_ERROR_LABEL[query.code] ?? query.message} ({query.message})
      </p>
    );
  }
  const { columns, rows, truncated, execution_ms } = query.result;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-2.5 py-1.5 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column} className="px-2.5 py-1.5">
                    {formatQueryValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {rows.length}행 표시 · {truncated ? "일부 결과만 표시 중(truncated)" : "전체 결과"} · {execution_ms}ms
      </p>
    </div>
  );
}

function ActionCard({
  turn,
  action,
  index,
  isStale,
  session,
}: {
  turn: KubiTurn;
  action: KubiAction;
  index: number;
  isStale: boolean;
  session: ReturnType<typeof useKubiSession>;
}) {
  const state: KubiActionRunState = turn.actionStates[index] ?? { status: "pending_approval" };

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{describeAction(action)}</p>
      <p className="mt-0.5 text-muted-foreground">{action.reason}</p>

      {action.type === "ADD_REPORT_BLOCK" ? (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Report에 추가될 노트
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{action.note}</p>
          {turn.response && turn.response.evidenceRefs.length > 0 ? (
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                연결된 Evidence
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {turn.response.evidenceRefs.map((ref) => (
                  <li
                    key={`${ref.kind}:${ref.id}`}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px]"
                  >
                    {ref.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.status === "approved" && action.type === "PATCH_BUILDSPEC" ? (
        (() => {
          const preview = session.previewPatch(turn.id, index);
          if (!preview) return null;
          if (!preview.ok) return <p className="mt-2 text-red-700 dark:text-red-300">{preview.reason}</p>;
          return (
            <div className="mt-2 rounded-lg border border-border p-2">
              <SpecDiff before={preview.before} after={preview.after} />
            </div>
          );
        })()
      ) : null}
      {state.status === "approved" && action.type === "CREATE_BUILD_DRAFT" ? (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px]">
          {JSON.stringify(action.values, null, 2)}
        </pre>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state.status === "pending_approval" ? (
          <>
            <Button size="sm" disabled={isStale} onClick={() => session.approveAction(turn.id, index)}>
              승인
            </Button>
            <Button size="sm" variant="ghost" onClick={() => session.rejectAction(turn.id, index)}>
              거부
            </Button>
          </>
        ) : null}
        {state.status === "approved" ? (
          <Button size="sm" disabled={isStale} onClick={() => session.confirmApprovedAction(turn.id, index)}>
            적용
          </Button>
        ) : null}
        {state.status === "applying" ? <span className="text-muted-foreground">적용 중…</span> : null}
        {state.status === "applied" ? <span className="text-emerald-700 dark:text-emerald-400">{state.message}</span> : null}
        {state.status === "rejected" ? <span className="text-muted-foreground">거부됨</span> : null}
        {state.status === "error" ? <span className="text-red-700 dark:text-red-300">{state.message}</span> : null}
        {isStale && (state.status === "pending_approval" || state.status === "approved") ? (
          <span className="text-amber-700 dark:text-amber-400">이전 화면 기준 — 실행할 수 없습니다</span>
        ) : null}
      </div>
    </div>
  );
}

function TurnCard({ turn, session }: { turn: KubiTurn; session: ReturnType<typeof useKubiSession> }) {
  const stale = session.isStale(turn);

  return (
    <div className="space-y-2">
      <div className="ml-auto max-w-[88%] rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
        {turn.question}
      </div>

      <div className="max-w-[92%] rounded-lg border border-border bg-card px-3 py-2 text-xs">
        {turn.isDemo ? (
          <p className="mb-1.5 mr-1.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
            DEMO · mock 데이터(실제 분석 아님)
          </p>
        ) : null}
        {stale ? (
          <p className="mb-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            이전 화면 기준
          </p>
        ) : null}

        {turn.status === "loading" ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            생각 중…
            <Button size="sm" variant="ghost" onClick={() => session.cancel(turn.id)}>
              취소
            </Button>
          </div>
        ) : null}

        {turn.status === "error" && turn.error ? <ErrorNotice error={turn.error} /> : null}

        {turn.response ? (
          <div className="space-y-2.5">
            <p className="whitespace-pre-wrap leading-6 text-foreground">{turn.response.answer}</p>

            {turn.error?.kind === "hallucinated_refs" ? (
              <p role="alert" className="text-[11px] text-amber-700 dark:text-amber-400">
                {turn.error.message}
              </p>
            ) : null}

            {turn.evidence?.partial ? (
              <p className="text-[11px] text-muted-foreground">
                일부 evidence를 확인하지 못했습니다: {turn.evidence.unavailable.join(", ")}
              </p>
            ) : null}

            {turn.response.evidenceRefs.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {turn.response.evidenceRefs.map((ref) => (
                    <li key={`${ref.kind}:${ref.id}`} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px]">
                      {ref.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {turn.response.generatedSql ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Generated SQL · {turn.response.generatedSql.stage}
                </p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/70 p-2 text-[11px]">{turn.response.generatedSql.sql}</pre>
                <Button
                  size="sm"
                  className="mt-1.5"
                  disabled={stale || turn.query.status === "running"}
                  onClick={() => session.executeQuery(turn.id)}
                >
                  {turn.query.status === "running" ? "실행 중…" : "실행"}
                </Button>
                <QueryResultView query={turn.query} />
              </div>
            ) : null}

            {turn.response.suggestedActions.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Suggested Actions</p>
                <div className="mt-1 space-y-1.5">
                  {turn.response.suggestedActions.map((action, index) => (
                    <ActionCard key={index} turn={turn} action={action} index={index} isStale={stale} session={session} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface KubiContentProps {
  compact?: boolean;
}

/** Kubi 대화 화면. drawer/페이지 공용. */
export function KubiContent({ compact = false }: KubiContentProps) {
  const session = useKubiSession();
  const { isConfigured } = useAssistConfig();
  const [input, setInput] = useState("");

  // BYOK가 없어도 mock 모드에서는 데모로 질문을 보낼 수 있다(#256 데모, real mode는 항상 BYOK 필요).
  const canSubmit = isConfigured || session.isDemoAvailable;

  // context bar의 QUALITY 칸: 현재 문맥과 일치하는(=stale 아닌) 가장 최근 turn의 evidence에서만 채운다.
  // route만으로는 quality를 알 수 없으므로, evidence가 아직 없으면 꾸며내지 않고 "—"로 둔다.
  const qualityLabel = useMemo(() => {
    for (let i = session.turns.length - 1; i >= 0; i -= 1) {
      const turn = session.turns[i];
      if (turn.evidence && !session.isStale(turn)) return summarizeKubiQuality(turn.evidence.quality);
    }
    return "—";
  }, [session.turns, session.isStale]);

  // "관련 데이터셋" 후보: LLM이 아니라 가장 최근 non-stale turn의 실제 catalog evidence만 근거로
  // 계산한다(#256 이슈 체크리스트, relatedDatasets.ts). turn이 아직 없으면(=evidence 미조회)
  // 빈 배열로 두고, 아래에서 그 이유를 그대로 안내한다 — 추측해서 채우지 않는다.
  const relatedDatasets = useMemo(() => {
    for (let i = session.turns.length - 1; i >= 0; i -= 1) {
      const turn = session.turns[i];
      if (turn.evidence && !session.isStale(turn)) return relatedCatalogDatasets(turn.evidence);
    }
    return [];
  }, [session.turns, session.isStale]);

  function submit(question: string) {
    setInput("");
    if (!isConfigured && session.isDemoAvailable) {
      void session.askDemo(question);
      return;
    }
    void session.ask(question);
  }

  return (
    <div className={compact ? "flex flex-col gap-4" : "grid gap-4 lg:grid-cols-[1fr_280px]"}>
      <div className="flex min-w-0 flex-col gap-4">
        <ContextBar context={session.liveContext} pageLabel={session.pageLabel} qualityLabel={qualityLabel} />

        {!isConfigured ? (
          <div className="space-y-3">
            <ApiKeySetup />
            {session.isDemoAvailable ? (
              <Card variant="dashed" className="space-y-2 p-4">
                <p className="text-sm font-semibold">API Key 없이 먼저 데모로 보기</p>
                <p className="text-xs text-muted-foreground">
                  mock 데이터 기반 예시 응답입니다 — 실제 분석 결과가 아닙니다. dev/mock 모드에서만 제공됩니다.
                </p>
                <Button size="sm" variant="secondary" onClick={() => submit(DEMO_QUESTION)}>
                  데모 질문 보내보기
                </Button>
              </Card>
            ) : null}
          </div>
        ) : null}

        {session.turns.length === 0 && !session.onboarded ? (
          <Card className="space-y-2 border-dashed p-4">
            <p className="text-sm font-semibold">처음이신가요?</p>
            <p className="text-xs text-muted-foreground">예시 질문으로 시작하거나 직접 질문할 수 있습니다.</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent hover:text-foreground"
                  onClick={() => submit(question)}
                  disabled={!canSubmit}
                >
                  {question}
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        <div className="flex flex-col gap-3">
          {session.turns.map((turn) => (
            <TurnCard key={turn.id} turn={turn} session={session} />
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim()) submit(input);
          }}
        >
          <input
            aria-label="Kubi에게 질문하기"
            className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            disabled={!canSubmit}
            onChange={(event) => setInput(event.target.value)}
            placeholder={isConfigured ? "질문을 입력하세요…" : canSubmit ? "질문을 입력하세요… (데모 · mock 데이터)" : "먼저 API Key를 설정하세요"}
            value={input}
          />
          <Button type="submit" disabled={!canSubmit || !input.trim()}>
            전송
          </Button>
        </form>
      </div>

      {!compact ? (
        <Card className="h-fit space-y-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">추천 질문</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent hover:text-foreground"
                  onClick={() => submit(question)}
                  disabled={!canSubmit}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
          {session.liveContext.datasetId ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">현재 Dataset</p>
              <Link
                className="mt-1 block text-xs font-medium text-accent-subtle-foreground underline"
                to={`/datasets/${encodeURIComponent(session.liveContext.datasetId)}`}
              >
                {session.liveContext.datasetId} 열기
              </Link>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">관련 데이터셋</p>
            {relatedDatasets.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {relatedDatasets.map((candidate) => (
                  <li
                    key={`${candidate.provider}::${candidate.dataset}`}
                    className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 text-xs last:border-0 last:pb-0"
                  >
                    <span className="truncate text-muted-foreground" title={candidate.dataset}>
                      {candidate.dataset}
                    </span>
                    <span className="shrink-0 font-medium text-foreground">{candidate.provider}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {session.liveContext.datasetId
                  ? "질문을 보내 evidence를 불러오면 같은 provider의 다른 데이터셋 후보를 확인할 수 있습니다."
                  : "Dataset을 선택하면 실제 catalog와 대조한 관련 데이터셋 후보를 확인할 수 있습니다."}
              </p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
