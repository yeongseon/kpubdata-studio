/**
 * Kubi 대화 세션 (#256).
 *
 * `KubiDrawer`와 `/kubi` 페이지, 상단 `KubiSearchInput`이 전부 이 훅 하나를 공유한다 —
 * 새 어시스턴트 시스템을 만들지 않고 기존 `features/assistant`(BYOK provider/config,
 * scrubSecrets)만 재사용한다. 대화 turn 상태는 zustand 싱글턴 스토어에 두어, drawer를 열고
 * 닫아도(그리고 `/kubi` 페이지로 이동해도) 같은 대화가 이어진다.
 *
 * Stale guard(#256 리뷰 §6): 각 turn은 시작 시점의 `KubiContext`를 그대로 고정해서 들고 있다.
 * 화면이 바뀐 뒤에도 과거 turn은 그대로 보이지만(덮어쓰지 않음), SQL 실행/Action 적용처럼
 * 실제 부작용이 있는 동작은 turn.context가 현재 라우트 context와 일치할 때만 허용한다.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAssistConfig } from "@/features/assistant/config";
import { createProvider } from "@/features/assistant/provider";
import { contextsMatch, resolveKubiContext } from "./context";
import { buildKubiDemoResponse, isKubiDemoAvailable, runKubiDemoQuery } from "./demo";
import { loadKubiEvidence } from "./evidence";
import { buildKubiMessages } from "./prompt";
import { parseKubiResponse } from "./parseResponse";
import { crossCheckKubiResponse } from "./crossCheck";
import { runKubiQuery } from "./query";
import {
  actionHref,
  applyAddReportBlock,
  applyBuildSpecPatch as applyBuildSpecPatchAction,
  applyCreateBuildDraft,
  previewBuildSpecPatch,
} from "./actions";
import type { KubiAction } from "./schema";
import type { KubiActionRunState, KubiContext, KubiTurn } from "./types";

function newTurnId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface KubiStoreState {
  turns: KubiTurn[];
  onboarded: boolean;
  addTurn: (turn: KubiTurn) => void;
  updateTurn: (id: string, updater: (turn: KubiTurn) => KubiTurn) => void;
  setOnboarded: () => void;
  clearTurns: () => void;
  pendingSeed: string | null;
  seedQuestion: (question: string) => void;
  consumeSeed: () => string | null;
}

/** Kubi 대화 상태 싱글턴. `onboarded`만 저장하고 대화 내용은 세션 동안만 유지한다(장기 저장 제외 범위). */
export const useKubiStore = create<KubiStoreState>()(
  persist(
    (set, get) => ({
      turns: [],
      onboarded: false,
      pendingSeed: null,
      addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),
      updateTurn: (id, updater) =>
        set((state) => ({
          turns: state.turns.map((turn) => (turn.id === id ? updater(turn) : turn)),
        })),
      setOnboarded: () => set({ onboarded: true }),
      clearTurns: () => set({ turns: [] }),
      seedQuestion: (question) => set({ pendingSeed: question }),
      consumeSeed: () => {
        const seed = get().pendingSeed;
        set({ pendingSeed: null });
        return seed;
      },
    }),
    {
      name: "kpubdata-studio:kubi",
      partialize: (state) => ({ onboarded: state.onboarded }),
    },
  ),
);

export interface UseKubiSessionResult {
  /** route에서 얻을 수 있는, 지금 이 순간의 context. */
  liveContext: KubiContext;
  pageLabel: string;
  onboarded: boolean;
  turns: KubiTurn[];
  isConfigured: boolean;
  /** mock Builder 모드에서만 true — BYOK 없이 `askDemo`를 쓸 수 있는지 UI가 판단하는 데 쓴다. */
  isDemoAvailable: boolean;
  ask: (question: string) => Promise<void>;
  /** BYOK/LLM 없이 mock evidence만으로 결정적 데모 답변을 만든다(`features/kubi/demo.ts`). */
  askDemo: (question: string) => Promise<void>;
  cancel: (turnId: string) => void;
  isStale: (turn: KubiTurn) => boolean;
  executeQuery: (turnId: string) => Promise<void>;
  approveAction: (turnId: string, index: number) => Promise<void>;
  confirmApprovedAction: (turnId: string, index: number) => Promise<void>;
  rejectAction: (turnId: string, index: number) => void;
  previewPatch: (turnId: string, index: number) => ReturnType<typeof previewBuildSpecPatch> | null;
  goToAction: (action: KubiAction) => void;
}

/**
 * Kubi 대화 세션 훅. `KubiDrawer`/`KubiPage`가 공유하는 유일한 진입점이다.
 *
 * @returns 현재 route context, 대화 turn 목록, 질문/취소/실행/승인 액션 함수.
 */
export function useKubiSession(): UseKubiSessionResult {
  const location = useLocation();
  const navigate = useNavigate();
  const { context: liveContext, pageLabel } = useMemo(
    () => resolveKubiContext(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const turns = useKubiStore((state) => state.turns);
  const onboarded = useKubiStore((state) => state.onboarded);
  const addTurn = useKubiStore((state) => state.addTurn);
  const updateTurn = useKubiStore((state) => state.updateTurn);
  const setOnboarded = useKubiStore((state) => state.setOnboarded);
  const pendingSeed = useKubiStore((state) => state.pendingSeed);
  const consumeSeed = useKubiStore((state) => state.consumeSeed);

  const { apiKey, model, baseUrl, baseUrlSafe, baseUrlError, isConfigured } = useAssistConfig();
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const isStale = useCallback((turn: KubiTurn) => !contextsMatch(turn.context, liveContext), [liveContext]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      setOnboarded();

      const turnId = newTurnId();
      const context = liveContext;
      const turn: KubiTurn = {
        id: turnId,
        question: trimmed,
        context,
        createdAt: new Date().toISOString(),
        status: "loading",
        query: { status: "idle" },
        actionStates: {},
      };
      addTurn(turn);

      if (!isConfigured) {
        updateTurn(turnId, (t) => ({ ...t, status: "error", error: { kind: "no_key" } }));
        return;
      }
      if (!baseUrlSafe) {
        updateTurn(turnId, (t) => ({
          ...t,
          status: "error",
          error: { kind: "bad_base_url", message: baseUrlError ?? "안전하지 않은 base URL입니다." },
        }));
        return;
      }

      const controller = new AbortController();
      controllersRef.current.set(turnId, controller);

      try {
        const { evidence, knownRefs, safeRunIds, safeEvidenceIds } = await loadKubiEvidence(
          context,
          controller.signal,
        );
        updateTurn(turnId, (t) => ({ ...t, evidence }));

        const provider = createProvider({ apiKey, model, baseUrl });
        const messages = buildKubiMessages(trimmed, evidence);
        let rawOutput = "";
        // LLM egress 스크러버에서 엔트로피 오탐 면제 대상: Builder 응답으로 존재가 확인된 exact
        // run id(safeRunIds) + Builder `/quality` 응답에서 deterministic 하게 만든 evidence
        // identifier(safeEvidenceIds). 그래야 모델이 실제 run id/quality id를 그대로 echo 해도
        // crossCheck(knownRefs)·suggestedAction 와 일치해 정상 근거·action 이 제거되지 않으면서,
        // 아직 확인되지 않은 route runId 나 임의 문자열은 엔트로피 스크럽 대상으로 남는다.
        for await (const chunk of provider.stream(messages, controller.signal, {
          safeRunIds: new Set<string>([...safeRunIds, ...safeEvidenceIds]),
        })) {
          rawOutput += chunk;
        }

        const parsed = parseKubiResponse(rawOutput);
        if (!parsed.ok) {
          updateTurn(turnId, (t) => ({
            ...t,
            status: "error",
            rawOutput,
            error: { kind: "malformed_output", message: parsed.message },
          }));
          return;
        }

        const checked = crossCheckKubiResponse(parsed.response, evidence, knownRefs);
        const actionStates: Record<number, KubiActionRunState> = {};
        checked.response.suggestedActions.forEach((_, index) => {
          actionStates[index] = { status: "pending_approval" };
        });

        // parse 단계에서 형식이 잘못돼 떼어낸 evidenceRef(예: 허용 목록 밖 kind)도
        // cross-check가 제거한 근거와 같은 자리에 함께 보여준다 — answer는 살린다.
        const malformedRefs = parsed.malformedEvidenceRefs;
        const rejectedRefs = [
          ...malformedRefs.map((ref) => `형식 오류로 제외: ${ref}`),
          ...checked.rejectedRefs,
        ];
        const hasRejections =
          rejectedRefs.length > 0 || checked.rejectedActions.length > 0 || Boolean(checked.rejectedSqlReason);

        updateTurn(turnId, (t) => ({
          ...t,
          status: "ok",
          rawOutput,
          response: checked.response,
          actionStates,
          error: hasRejections
            ? {
                kind: "hallucinated_refs",
                message: [
                  checked.rejectedSqlReason,
                  rejectedRefs.length ? `제외된 근거: ${rejectedRefs.join(", ")}` : null,
                  checked.rejectedActions.length ? `제외된 action: ${checked.rejectedActions.join(", ")}` : null,
                ]
                  .filter(Boolean)
                  .join(" "),
                rejectedRefs,
                rejectedActions: checked.rejectedActions,
              }
            : undefined,
        }));
      } catch (cause) {
        if (controller.signal.aborted) {
          updateTurn(turnId, (t) => ({ ...t, status: "error", error: { kind: "cancelled" } }));
          return;
        }
        updateTurn(turnId, (t) => ({
          ...t,
          status: "error",
          error: { kind: "llm_error", message: cause instanceof Error ? cause.message : "LLM 호출에 실패했습니다." },
        }));
      } finally {
        controllersRef.current.delete(turnId);
      }
    },
    [liveContext, isConfigured, baseUrlSafe, baseUrlError, apiKey, model, baseUrl, addTurn, updateTurn, setOnboarded],
  );

  const askDemo = useCallback(
    async (question: string) => {
      if (!isKubiDemoAvailable()) return;
      const trimmed = question.trim();
      if (!trimmed) return;
      setOnboarded();

      const turnId = newTurnId();
      const context = liveContext;
      const turn: KubiTurn = {
        id: turnId,
        question: trimmed,
        context,
        createdAt: new Date().toISOString(),
        status: "loading",
        query: { status: "idle" },
        actionStates: {},
        isDemo: true,
      };
      addTurn(turn);

      const controller = new AbortController();
      controllersRef.current.set(turnId, controller);
      try {
        const { evidence } = await loadKubiEvidence(context, controller.signal);
        const response = buildKubiDemoResponse(evidence);
        updateTurn(turnId, (t) => ({ ...t, status: "ok", evidence, response }));
      } catch (cause) {
        if (controller.signal.aborted) {
          updateTurn(turnId, (t) => ({ ...t, status: "error", error: { kind: "cancelled" } }));
          return;
        }
        updateTurn(turnId, (t) => ({
          ...t,
          status: "error",
          error: { kind: "llm_error", message: cause instanceof Error ? cause.message : "데모 evidence 조회에 실패했습니다." },
        }));
      } finally {
        controllersRef.current.delete(turnId);
      }
    },
    [liveContext, addTurn, updateTurn, setOnboarded],
  );

  const cancel = useCallback((turnId: string) => {
    controllersRef.current.get(turnId)?.abort();
  }, []);

  const executeQuery = useCallback(
    async (turnId: string) => {
      const turn = turns.find((t) => t.id === turnId);
      const sql = turn?.response?.generatedSql;
      if (!turn || !sql) return;
      if (!contextsMatch(turn.context, liveContext)) {
        updateTurn(turnId, (t) => ({
          ...t,
          query: { status: "error", code: "invalid_context", message: "화면 문맥이 바뀌어 이 SQL을 실행할 수 없습니다." },
        }));
        return;
      }
      updateTurn(turnId, (t) => ({ ...t, query: { status: "running" } }));

      // 데모 turn은 Builder `/query`를 호출하지 않는다 — 고정된 mock 결과만 보여준다(#256 데모).
      if (turn.isDemo) {
        const result = await runKubiDemoQuery();
        updateTurn(turnId, (t) => ({ ...t, query: result }));
        return;
      }

      const controller = new AbortController();
      controllersRef.current.set(`${turnId}:query`, controller);
      const result = await runKubiQuery(turn.context, sql, controller.signal);
      controllersRef.current.delete(`${turnId}:query`);
      updateTurn(turnId, (t) => ({ ...t, query: result }));
    },
    [turns, liveContext, updateTurn],
  );

  const setActionState = useCallback(
    (turnId: string, index: number, state: KubiActionRunState) => {
      updateTurn(turnId, (t) => ({ ...t, actionStates: { ...t.actionStates, [index]: state } }));
    },
    [updateTurn],
  );

  const goToAction = useCallback(
    (action: KubiAction) => {
      const href = actionHref(action);
      if (href) navigate(href);
    },
    [navigate],
  );

  // OPEN_* / ADD_REPORT_BLOCK은 한 번의 승인으로 즉시 적용한다. PATCH_BUILDSPEC/CREATE_BUILD_DRAFT는
  // diff/미리보기를 먼저 보여줘야 하므로 "approved" 상태로만 전환하고 실제 적용은 confirmApprovedAction이 한다.
  const approveAction = useCallback(
    async (turnId: string, index: number) => {
      const turn = turns.find((t) => t.id === turnId);
      const action = turn?.response?.suggestedActions[index];
      if (!turn || !action) return;
      if (!contextsMatch(turn.context, liveContext)) {
        setActionState(turnId, index, { status: "error", message: "화면 문맥이 바뀌어 이 action을 실행할 수 없습니다." });
        return;
      }

      if (action.type === "PATCH_BUILDSPEC" || action.type === "CREATE_BUILD_DRAFT") {
        setActionState(turnId, index, { status: "approved" });
        return;
      }

      setActionState(turnId, index, { status: "applying" });
      try {
        if (action.type === "OPEN_PROVIDER" || action.type === "OPEN_BUILD" || action.type === "OPEN_QUALITY") {
          goToAction(action);
          setActionState(turnId, index, { status: "applied", message: "화면을 열었습니다." });
        } else if (action.type === "ADD_REPORT_BLOCK") {
          applyAddReportBlock(action, turn.context);
          setActionState(turnId, index, { status: "applied", message: "Report 참고 노트로 추가했습니다." });
        }
      } catch (cause) {
        setActionState(turnId, index, {
          status: "error",
          message: cause instanceof Error ? cause.message : "action을 적용하지 못했습니다.",
        });
      }
    },
    [turns, liveContext, setActionState, goToAction],
  );

  const previewPatch = useCallback(
    (turnId: string, index: number) => {
      const turn = turns.find((t) => t.id === turnId);
      const action = turn?.response?.suggestedActions[index];
      if (!action || action.type !== "PATCH_BUILDSPEC") return null;
      return previewBuildSpecPatch(action);
    },
    [turns],
  );

  const confirmApprovedAction = useCallback(
    async (turnId: string, index: number) => {
      const turn = turns.find((t) => t.id === turnId);
      const action = turn?.response?.suggestedActions[index];
      if (!turn || !action) return;
      if (!contextsMatch(turn.context, liveContext)) {
        setActionState(turnId, index, { status: "error", message: "화면 문맥이 바뀌어 이 action을 적용할 수 없습니다." });
        return;
      }

      setActionState(turnId, index, { status: "applying" });

      if (action.type === "PATCH_BUILDSPEC") {
        const preview = previewBuildSpecPatch(action);
        if (!preview.ok) {
          setActionState(turnId, index, { status: "error", message: preview.reason });
          return;
        }
        try {
          const result = await applyBuildSpecPatchAction(action.runId, preview.after);
          setActionState(turnId, index, {
            status: "applied",
            message: result.valid
              ? "BuildSpec에 적용했고 Builder /validate를 통과했습니다."
              : `BuildSpec에 적용했지만 Builder /validate에 실패했습니다: ${result.errors.join("; ")}`,
          });
        } catch (cause) {
          setActionState(turnId, index, {
            status: "error",
            message: cause instanceof Error ? cause.message : "BuildSpec patch 적용에 실패했습니다.",
          });
        }
        return;
      }

      if (action.type === "CREATE_BUILD_DRAFT") {
        try {
          applyCreateBuildDraft(action);
          setActionState(turnId, index, { status: "applied", message: "New Build 초안에 저장했습니다." });
          navigate("/builds/new");
        } catch (cause) {
          setActionState(turnId, index, {
            status: "error",
            message: cause instanceof Error ? cause.message : "초안을 저장하지 못했습니다.",
          });
        }
      }
    },
    [turns, liveContext, setActionState, navigate],
  );

  const rejectAction = useCallback(
    (turnId: string, index: number) => {
      setActionState(turnId, index, { status: "rejected", reason: "사용자가 이 action을 거부했습니다." });
    },
    [setActionState],
  );

  // 상단 검색창(KubiSearchInput)이 남겨둔 질문을 소비한다. KubiDrawer와 `/kubi` 페이지가 동시에
  // mount되어 있을 수 있어(둘 다 이 훅을 쓴다), consumeSeed()의 atomic pop으로 정확히 한 곳에서만
  // ask()가 호출되게 한다 — 같은 질문이 두 번 실행되지 않는다.
  useEffect(() => {
    if (!pendingSeed) return;
    const seed = consumeSeed();
    if (seed) void ask(seed);
  }, [pendingSeed, consumeSeed, ask]);

  return {
    liveContext,
    pageLabel,
    onboarded,
    turns,
    isConfigured,
    isDemoAvailable: isKubiDemoAvailable(),
    ask,
    askDemo,
    cancel,
    isStale,
    executeQuery,
    approveAction,
    confirmApprovedAction,
    rejectAction,
    previewPatch,
    goToAction,
  };
}
