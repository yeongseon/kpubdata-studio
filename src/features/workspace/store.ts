/**
 * 워크스페이스(팀/공간) 개념 스토어 (#14, v0.3 MVP).
 *
 * 사용자가 여러 워크스페이스(개인/팀)를 전환하며 작업한다는 개념을 도입한다. 현재는
 * 정적 목록 + 활성 워크스페이스(localStorage 유지)만 제공하며, 추후 서버/팀 멤버십
 * 연동 시 목록을 동적으로 채운다.
 */
import { create } from "zustand";

export interface Workspace {
  /** 워크스페이스 식별자 */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 설명 */
  description: string;
}

/** v0.3 개념용 정적 워크스페이스 목록. 추후 서버 연동으로 대체한다. */
export const WORKSPACES: Workspace[] = [
  { id: "personal", name: "개인 워크스페이스", description: "나만의 빌드 공간" },
  { id: "team-data", name: "데이터팀", description: "팀이 공유하는 빌드 공간" },
];

const ACTIVE_KEY = "kpubdata-studio:active-workspace";

/** 저장된 활성 워크스페이스 ID를 불러온다(없거나 유효하지 않으면 첫 번째). */
function loadActiveId(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && WORKSPACES.some((workspace) => workspace.id === saved)) return saved;
  } catch {
    // localStorage 접근 불가 시 기본값.
  }
  return WORKSPACES[0].id;
}

interface WorkspaceState {
  /** 사용 가능한 워크스페이스 목록 */
  workspaces: Workspace[];
  /** 현재 활성 워크스페이스 ID */
  activeWorkspaceId: string;
  /** 활성 워크스페이스를 전환한다(localStorage에 유지). */
  setActiveWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: WORKSPACES,
  activeWorkspaceId: loadActiveId(),
  setActiveWorkspace: (id) => {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // 무시.
    }
    set({ activeWorkspaceId: id });
  },
}));
