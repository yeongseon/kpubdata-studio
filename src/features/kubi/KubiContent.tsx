/**
 * Kubi 대화 UI (#256).
 *
 * `KubiDrawer`(전역 drawer)와 `/kubi` 전용 페이지가 이 컴포넌트 하나를 공유한다 — 두 번째
 * Kubi 시스템을 만들지 않는다. `compact`는 drawer(좁은 폭)와 페이지(넓은 폭) 레이아웃만
 * 다르게 하고, 상태 로직은 전부 `useKubiSession`에 있다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SpecDiff } from "@/features/build-spec/components/SpecDiff";
import { useAssistConfig } from "@/features/assistant/config";
import { Button, Card, Disclosure, Textarea } from "@/shared/ui";
import { describeAction } from "./actions";
import { relatedCatalogDatasets } from "./relatedDatasets";
import type { KubiAction } from "./schema";
import { SUGGESTED_QUESTIONS } from "./suggestedQuestions";
import { summarizeKubiQuality } from "./types";
import type { KubiActionRunState, KubiContext, KubiErrorState, KubiQueryState, KubiTurn } from "./types";
import { useKubiSession } from "./useKubiSession";
import { MarkdownContent } from "./MarkdownContent";
import type { KubiEvidenceRef } from "./types";
import { formatSqlForDisplay } from "./formatSqlForDisplay";

/** 데모 CTA와 onboarding 예시 질문이 함께 쓰는 기본 질문(mock evidence만으로도 답이 나온다). */
const DEMO_QUESTION = "이 데이터셋 품질 어때?";

/**
 * 프로토타입 구조(DATASET/BUILD(RUN)/STAGE/QUALITY 4칸)를 따르는 context bar (#256 review).
 * PAGE는 프로토타입에서도 별도 grid cell이 아니라 drawer 헤더의 보조 캡션이었으므로, 여기서도
 * 작은 캡션 한 줄로만 표시한다 — 4칸을 차지하지 않는다.
 */
function ContextBar({ context, pageLabel, qualityLabel, sources, onContextChange }: { context: KubiContext; pageLabel: string; qualityLabel: string; sources: string[]; onContextChange: (key: "stage" | "source", value?: string) => void }) {
  const cells: { label: string; value: string }[] = [
    { label: "DATASET", value: context.datasetId ?? "—" },
    { label: "RUN", value: context.runId ?? "—" },
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
        <label className="rounded-lg border border-border bg-muted/40 px-2.5 py-2"><span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">STAGE</span><select aria-label="Kubi 분석 Stage" className="mt-0.5 w-full bg-transparent text-xs font-medium" value={context.stage ?? ""} onChange={(event) => onContextChange("stage", event.target.value || undefined)} disabled={!context.runId}><option value="">{context.runId ? "Run 전체" : "사용 불가"}</option><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option></select></label>
      </div>
      {context.runId && sources.length > 1 ? <label className="mt-2 block text-xs text-muted-foreground">분석 Source<select aria-label="Kubi 분석 Source" className="ml-2 rounded border border-input bg-card px-2 py-1 text-foreground" value={context.source ?? ""} onChange={(event) => onContextChange("source", event.target.value || undefined)}><option value="">먼저 선택하세요</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label> : null}
      <p className="mt-2 text-[11px] text-muted-foreground">{!context.runId ? "Run을 선택하면 Run 및 Stage 근거를 분석할 수 있습니다." : sources.length > 1 && !context.source ? "이 Run에는 source가 여러 개 있습니다. 분석할 source를 먼저 선택하세요." : !context.stage ? "Run 전체를 분석 중입니다. SQL을 생성하려면 Silver 또는 Gold를 선택하세요." : context.stage === "bronze" ? "Bronze에서는 Generated SQL을 실행할 수 없습니다. Silver 또는 Gold를 선택하세요." : `${context.stage === "gold" ? "Gold" : "Silver"} schema 기반 질문 및 SQL 생성 가능`}</p>
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

export function ErrorNotice({ error, onRetry }: { error: KubiErrorState; onRetry?: () => void }) {
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
  const isNavigation = action.type === "OPEN_BUILD" || action.type === "OPEN_QUALITY" || action.type === "OPEN_PROVIDER";

  return (
    <div className={isNavigation ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs" : "rounded-lg border border-border bg-card px-3 py-2 text-xs"}>
      <div className={isNavigation ? "min-w-0" : undefined}>
      {action.type === "PATCH_BUILDSPEC" ? (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
          BuildSpec 변경 제안
        </span>
      ) : null}
      <p className="font-medium text-foreground">{describeAction(action)}</p>
      <p className="mt-0.5 text-muted-foreground">{action.reason}</p>

      </div>

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

      <div className={`${isNavigation ? "" : "mt-2"} flex flex-wrap items-center gap-2`}>
        {state.status === "pending_approval" ? (
          <>
            <Button size="sm" aria-label={isNavigation ? "승인" : undefined} disabled={isStale} onClick={() => session.approveAction(turn.id, index)}>
              {isNavigation ? "열기" : "승인"}
            </Button>
            <Button className={isNavigation ? "sr-only" : undefined} size="sm" variant="ghost" onClick={() => session.rejectAction(turn.id, index)}>
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

export function evidenceDetail(turn: KubiTurn, ref: KubiEvidenceRef) {
  const evidence = turn.evidence;
  if (!evidence) return null;
  if (ref.kind === "quality") return evidence.quality?.results.find((item) => item.id === ref.id) ?? null;
  if (ref.kind === "schema_drift") return evidence.quality?.schemaDrift.find((item) => `${item.kind}::${item.column ?? "_"}` === ref.id) ?? null;
  if (ref.kind === "dataset" && evidence.dataset?.datasetId === ref.id) return evidence.dataset;
  if (ref.kind === "run") return evidence.recentRuns?.find((item) => item.runId === ref.id) ?? (turn.context.runId === ref.id ? { runId: ref.id } : null);
  if (ref.kind === "stage" && evidence.stage?.refId === ref.id) return evidence.stage;
  if (ref.kind === "catalog" && evidence.catalog) return evidence.catalog;
  return null;
}

export function evidenceDetailEntries(turn: KubiTurn, ref: KubiEvidenceRef): [string, string][] {
  const detail = evidenceDetail(turn, ref);
  if (!detail) return [];
  if (ref.kind === "stage" && turn.evidence?.stage) {
    const stage = turn.evidence.stage;
    return [
      ["Stage", stage.stage[0].toUpperCase() + stage.stage.slice(1)],
      ["Source", stage.source],
      ["Status", stage.status],
      ["Rows", stage.rowCount === null ? "—" : String(stage.rowCount)],
      ...(stage.columns ? [["Columns", String(stage.columns.length)] as [string, string]] : []),
    ];
  }
  return Object.entries(detail)
    .filter(([, value]) => value !== undefined && typeof value !== "object")
    .map(([key, value]) => [key, String(value ?? "—")]);
}

export function evidenceHref(turn: KubiTurn, ref: KubiEvidenceRef): string | null {
  const detail = evidenceDetail(turn, ref);
  if (!detail) return null;
  if (ref.kind === "dataset") return turn.evidence?.deepLinks.datasetDetail ?? null;
  if (ref.kind === "run") {
    if (!("runId" in detail) || typeof detail.runId !== "string") return null;
    const targetRunId = detail.runId;
    const params = new URLSearchParams({ run: targetRunId });
    if (turn.context.datasetId) params.set("dataset", turn.context.datasetId);
    // source/stage는 해당 run에서 검증된 문맥일 때만 유효하다. 다른 recent run으로 이동할
    // 때 현재 run의 선택을 carry하면 존재하지 않는 조합이 되므로 함께 넘기지 않는다.
    if (targetRunId === turn.context.runId) {
      if (turn.context.source) params.set("source", turn.context.source);
      if (turn.context.stage) params.set("stage", turn.context.stage);
    }
    return `/builds?${params}`;
  }
  if (ref.kind === "stage") {
    if (!turn.context.runId) return null;
    const params = new URLSearchParams({ run: turn.context.runId });
    if (turn.context.datasetId) params.set("dataset", turn.context.datasetId);
    if (turn.context.source) params.set("source", turn.context.source);
    if (turn.context.stage) params.set("stage", turn.context.stage);
    return `/builds?${params}`;
  }
  if (ref.kind === "quality" || ref.kind === "schema_drift") {
    if (!turn.context.runId && !turn.context.datasetId) return null;
    const params = new URLSearchParams();
    if (turn.context.datasetId) params.set("dataset", turn.context.datasetId);
    if (turn.context.runId) params.set("run", turn.context.runId);
    if ("source" in detail && typeof detail.source === "string") params.set("source", detail.source);
    else if (turn.context.source) params.set("source", turn.context.source);
    if (turn.context.stage) params.set("stage", turn.context.stage);
    return `/quality?${params}`;
  }
  return null;
}

function EvidenceSection({ turn }: { turn: KubiTurn }) {
  const [selected, setSelected] = useState<KubiEvidenceRef | null>(null);
  const refs = turn.response?.evidenceRefs ?? [];
  const rejected = turn.error?.kind === "hallucinated_refs" ? turn.error.rejectedRefs : [];
  if (!refs.length && !rejected.length && !turn.evidence?.partial) return null;
  const detail = selected ? evidenceDetail(turn, selected) : null;
  const detailEntries = selected ? evidenceDetailEntries(turn, selected) : [];
  const href = selected ? evidenceHref(turn, selected) : null;
  return <Disclosure title={`근거 ${refs.length}개${rejected.length ? ` · 제외된 근거 ${rejected.length}개` : ""}`}>
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">{refs.map((ref) => <button key={`${ref.kind}:${ref.id}`} type="button" aria-pressed={selected?.kind === ref.kind && selected.id === ref.id} onClick={() => setSelected(ref)} className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ref.label}</button>)}</div>
      {selected ? <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <p className="font-semibold">{selected.label}</p>
        {detail ? <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{detailEntries.map(([key, value]) => <div className="contents" key={key}><dt className="text-muted-foreground">{key}</dt><dd className="break-all">{value}</dd></div>)}</dl> : <p className="mt-1 text-muted-foreground">상세 근거를 현재 evidence에서 확인할 수 없습니다.</p>}
        {href ? <Link className="mt-2 inline-block font-medium underline" to={href}>원본 화면 열기</Link> : null}
      </div> : null}
      {rejected.length ? <Disclosure title={`⚠ 제외된 근거 ${rejected.length}개`}>{<ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{rejected.map((item) => <li key={item}>{item}</li>)}</ul>}</Disclosure> : null}
      {turn.evidence?.partial ? <p className="text-[11px] text-muted-foreground">확인하지 못한 근거: {turn.evidence.unavailable.join(", ")}</p> : null}
    </div>
  </Disclosure>;
}

function LoadingPhase({ turn }: { turn: KubiTurn }) {
  const steps = [
    ["collecting_evidence", "Evidence 확인"],
    ["generating", "답변 생성"],
    ["validating", "근거 검증"],
  ] as const;
  const current = steps.findIndex(([phase]) => phase === turn.phase);
  return <div aria-live="polite" className="space-y-1 text-muted-foreground">{steps.map(([phase, label], index) => <p key={phase}>{index < current ? "✓" : index === current ? "●" : "○"} {label}{index === current ? " 중" : ""}</p>)}</div>;
}

function TurnCard({ turn, session, collapsed = false, onToggle }: { turn: KubiTurn; session: ReturnType<typeof useKubiSession>; collapsed?: boolean; onToggle?: () => void }) {
  const stale = session.isStale(turn);

  if (collapsed) return <button type="button" aria-expanded="false" onClick={onToggle} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-muted"><span>{turn.status === "ok" ? "성공" : turn.status === "error" ? "실패" : "진행 중"}</span><span className="truncate font-medium">{turn.question}</span>{stale ? <span className="ml-auto shrink-0 text-amber-700">이전 화면</span> : null}</button>;

  return (
    <div className="space-y-2">
      {onToggle ? <div className="flex justify-end"><button type="button" aria-expanded="true" onClick={onToggle} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">대화 접기</button></div> : null}
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
            <LoadingPhase turn={turn} />
            <Button size="sm" variant="ghost" onClick={() => session.cancel(turn.id)}>
              취소
            </Button>
          </div>
        ) : null}

        {turn.status === "error" && turn.error ? <ErrorNotice error={turn.error} /> : null}

        {turn.response ? (
          <div className="space-y-2.5">
            <MarkdownContent>{turn.response.answer}</MarkdownContent>

            {turn.error?.kind === "hallucinated_refs" ? (
              <p role="alert" className="text-[11px] text-amber-700 dark:text-amber-400">
                {turn.error.message}
              </p>
            ) : null}

            <EvidenceSection turn={turn} />

            {turn.response.generatedSql ? (
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Generated SQL · {turn.response.generatedSql.stage}</p><Button size="sm" variant="ghost" aria-label="Generated SQL 복사" onClick={() => void navigator.clipboard.writeText(turn.response!.generatedSql!.sql)}>복사</Button></div>
                <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre rounded-lg bg-muted/70 p-2 font-mono text-[11px]">{formatSqlForDisplay(turn.response.generatedSql.sql)}</pre>
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
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured } = useAssistConfig();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openPastTurns, setOpenPastTurns] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

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

  const contextSources = useMemo(() => {
    const values = new Set<string>();
    for (let i = session.turns.length - 1; i >= 0; i -= 1) {
      const turn = session.turns[i];
      if (!turn.evidence || session.isStale(turn)) continue;
      turn.evidence.quality?.results.forEach((item) => values.add(item.source));
      if (turn.evidence.stage?.source) values.add(turn.evidence.stage.source);
      break;
    }
    return [...values];
  }, [session.turns, session.isStale]);

  const suggestedQuestions = useMemo(() => {
    if (session.liveContext.stage === "gold" || session.liveContext.stage === "silver") return ["사용할 수 있는 컬럼을 알려줘.", "이 데이터를 집계하는 SQL을 만들어줘."];
    if (session.liveContext.page === "quality") return ["Quality 결과를 요약해줘.", "FAIL/WARN의 원인을 알려줘."];
    if (session.liveContext.runId) return ["이 Run 상태를 요약해줘.", "실패 원인이 있으면 알려줘."];
    if (session.liveContext.datasetId) return ["이 Dataset의 특징을 알려줘."];
    return SUGGESTED_QUESTIONS;
  }, [session.liveContext]);

  function changeContext(key: "stage" | "source", value?: string) {
    const params = new URLSearchParams(location.search);
    if (value) params.set(key, value); else params.delete(key);
    if (key === "source") params.delete("stage");
    navigate(`${location.pathname}${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => { latestRef.current?.scrollIntoView?.({ block: "start" }); }, [session.turns.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [input]);

  function submit(question: string) {
    setInput("");
    if (!isConfigured && session.isDemoAvailable) {
      void session.askDemo(question);
      return;
    }
    void session.ask(question);
  }

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "grid gap-4 lg:grid-cols-[1fr_280px]"}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={compact ? "shrink-0 border-b border-border px-5 py-3" : "mb-4"}><ContextBar context={session.liveContext} pageLabel={session.pageLabel} qualityLabel={qualityLabel} sources={contextSources} onContextChange={changeContext} /></div>

        <div className={compact ? "min-h-0 flex-1 overflow-y-auto px-5 py-4" : "space-y-4"} data-testid="kubi-conversation">

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
              {suggestedQuestions.map((question) => (
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

        {session.turns.length > 1 ? <div className="mb-3"><button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)} className="text-xs font-semibold text-muted-foreground">{historyOpen ? "▼" : "▶"} 이전 대화 {session.turns.length - 1}개</button>{historyOpen ? <div className="mt-2 space-y-2">{session.turns.slice(0, -1).map((turn) => <TurnCard key={turn.id} turn={turn} session={session} collapsed={!openPastTurns.has(turn.id)} onToggle={() => setOpenPastTurns((current) => { const next = new Set(current); if (next.has(turn.id)) next.delete(turn.id); else next.add(turn.id); return next; })} />)}</div> : null}</div> : null}
        {session.turns.length ? <div ref={latestRef}><TurnCard turn={session.turns[session.turns.length - 1]} session={session} /></div> : null}
        </div>

        <form
          className={compact ? "flex shrink-0 items-end gap-2 border-t border-border bg-card px-5 py-3" : "mt-4 flex items-end gap-2"}
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim()) submit(input);
          }}
        >
          <Textarea
            ref={textareaRef}
            rows={2}
            aria-label="Kubi에게 질문하기"
            className="max-h-36 min-h-[4.25rem] flex-1 resize-none overflow-y-auto"
            disabled={!canSubmit}
            onChange={(event) => setInput(event.target.value)}
            placeholder={isConfigured ? "질문을 입력하세요…" : canSubmit ? "질문을 입력하세요… (데모 · mock 데이터)" : "먼저 API Key를 설정하세요"}
            value={input}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !composingRef.current && !event.nativeEvent.isComposing) { event.preventDefault(); if (input.trim()) submit(input); } }}
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
              {suggestedQuestions.map((question) => (
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
