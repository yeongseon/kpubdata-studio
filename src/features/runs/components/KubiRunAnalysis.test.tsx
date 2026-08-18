/**
 * KubiRunAnalysis (#255 §2) — Builds/Runs "이 Run 분석" inline card.
 *
 * 새 Kubi 엔진을 만들지 않고 `useKubiSession`을 그대로 재사용하므로, 여기서는 그 훅을 mock해
 * turn 상태별로 카드가 올바른 것만 보여주는지 확인한다: BYOK 미설정, 로딩 준비 중, 진행 중,
 * 답변 도착, 에러, 그리고 stale turn을 제외하는지(#256 stale-context guard).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UseKubiSessionResult } from "@/features/kubi/useKubiSession";
import type { KubiTurn } from "@/features/kubi/types";
import { KubiRunAnalysis } from "./KubiRunAnalysis";

const { useKubiSessionMock, useAssistConfigMock } = vi.hoisted(() => ({
  useKubiSessionMock: vi.fn(),
  useAssistConfigMock: vi.fn(),
}));

vi.mock("@/features/kubi/useKubiSession", async () => {
  const actual = await vi.importActual<typeof import("@/features/kubi/useKubiSession")>(
    "@/features/kubi/useKubiSession",
  );
  return { ...actual, useKubiSession: useKubiSessionMock };
});

vi.mock("@/features/assistant/config", () => ({
  useAssistConfig: useAssistConfigMock,
}));

function baseTurn(overrides: Partial<KubiTurn> = {}): KubiTurn {
  return {
    id: "turn-1",
    question: "Run run-1의 상태와 실패 원인을 분석해줘.",
    context: { page: "builds", runId: "run-1" },
    createdAt: "2026-08-18T00:00:00Z",
    status: "ok",
    query: { status: "idle" },
    actionStates: {},
    ...overrides,
  };
}

function session(overrides: Partial<UseKubiSessionResult> = {}): UseKubiSessionResult {
  return {
    liveContext: { page: "builds", runId: "run-1" },
    pageLabel: "Builds / Runs",
    onboarded: true,
    turns: [],
    isConfigured: true,
    isDemoAvailable: false,
    ask: vi.fn(),
    askDemo: vi.fn(),
    cancel: vi.fn(),
    isStale: () => false,
    executeQuery: vi.fn(),
    approveAction: vi.fn(),
    confirmApprovedAction: vi.fn(),
    rejectAction: vi.fn(),
    previewPatch: () => null,
    goToAction: vi.fn(),
    ...overrides,
  };
}

describe("KubiRunAnalysis", () => {
  it("asks the user to configure an API key when Kubi isn't configured and no demo is available", () => {
    useKubiSessionMock.mockReturnValue(session({ turns: [] }));
    useAssistConfigMock.mockReturnValue({ isConfigured: false });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.getByText("Kubi를 사용하려면 API Key 설정이 필요합니다.")).toBeInTheDocument();
    expect(screen.queryByText(/분석 준비 중/)).not.toBeInTheDocument();
  });

  it("shows a preparing indicator while no matching turn exists yet", () => {
    useKubiSessionMock.mockReturnValue(session({ turns: [] }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.getByText("분석 준비 중…")).toBeInTheDocument();
  });

  it("shows the loading state with a cancel button while the turn is in flight", () => {
    const cancel = vi.fn();
    const turn = baseTurn({ status: "loading" });
    useKubiSessionMock.mockReturnValue(session({ turns: [turn], cancel, isStale: () => false }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.getByText("생각 중…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(cancel).toHaveBeenCalledWith("turn-1");
  });

  it("shows the answer and evidence summary once the turn completes", () => {
    const turn = baseTurn({
      status: "ok",
      response: {
        answer: "이 Run은 source air의 silver 단계에서 실패했습니다.",
        evidenceRefs: [{ kind: "stage", id: "air::silver", label: "air / silver" }],
        generatedSql: null,
        suggestedActions: [],
      },
    });
    useKubiSessionMock.mockReturnValue(session({ turns: [turn], isStale: () => false }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.getByText("이 Run은 source air의 silver 단계에서 실패했습니다.")).toBeInTheDocument();
    expect(screen.getByText("air / silver")).toBeInTheDocument();
  });

  it("shows an error notice when the turn failed", () => {
    const turn = baseTurn({ status: "error", error: { kind: "llm_error", message: "LLM 호출 실패" } });
    useKubiSessionMock.mockReturnValue(session({ turns: [turn], isStale: () => false }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.getByText("LLM 호출 실패")).toBeInTheDocument();
  });

  it("does not show a stale turn from a previous Run's context", () => {
    const turn = baseTurn({
      status: "ok",
      response: { answer: "이전 run 분석 결과", evidenceRefs: [], generatedSql: null, suggestedActions: [] },
    });
    useKubiSessionMock.mockReturnValue(session({ turns: [turn], isStale: () => true }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={vi.fn()} onAskMore={vi.fn()} />);

    expect(screen.queryByText("이전 run 분석 결과")).not.toBeInTheDocument();
    expect(screen.getByText("분석 준비 중…")).toBeInTheDocument();
  });

  it("wires 닫기/더 질문하기 to onClose/onAskMore", () => {
    const onClose = vi.fn();
    const onAskMore = vi.fn();
    useKubiSessionMock.mockReturnValue(session({ turns: [] }));
    useAssistConfigMock.mockReturnValue({ isConfigured: true });

    render(<KubiRunAnalysis onClose={onClose} onAskMore={onAskMore} />);

    fireEvent.click(screen.getByText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "더 질문하기" }));
    expect(onAskMore).toHaveBeenCalledTimes(1);
  });
});
