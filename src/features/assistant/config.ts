/**
 * 어시스턴트 설정 상태 (#205, ST-A2).
 *
 * LLM API 키는 **기본 메모리 전용**. 인증 토큰과 달리 세션마다 재입력받으면
 * 마찰이 크므로 "이 브라우저에 저장" 옵트인을 명시적 경고와 함께 제공한다.
 * 기본값은 저장하지 않는 쪽이다.
 */
import { create } from "zustand";

const STORAGE_KEY = "kpubdata-assist-key";
const STORAGE_WARNING =
  "LLM API 키가 이 브라우저에 평문으로 저장됩니다. XSS 공격 시 탈취될 수 있습니다. 신뢰하지 않는 확장 프로그램이 있다면 저장하지 마세요.";

interface AssistConfigState {
  apiKey: string;
  model: string;
  baseUrl: string;
  persistToStorage: boolean;
  isConfigured: boolean;
  setConfig: (config: { apiKey: string; model?: string; baseUrl?: string }) => void;
  enablePersistence: () => void;
  disablePersistence: () => void;
  clear: () => void;
}

function _loadPersistedKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePersistedKey(key: string): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage 접근 실패(SSR/프라이빗 모드)는 무시
  }
}

export const useAssistConfig = create<AssistConfigState>((set, get) => ({
  apiKey: "",
  model: "",
  baseUrl: "",
  persistToStorage: false,
  isConfigured: false,
  setConfig: (config) => {
    set({
      apiKey: config.apiKey,
      model: config.model ?? "",
      baseUrl: config.baseUrl ?? "",
      isConfigured: config.apiKey.length > 0,
    });
    if (get().persistToStorage) savePersistedKey(config.apiKey);
  },
  enablePersistence: () => {
    if (typeof window !== "undefined" && window.confirm(STORAGE_WARNING)) {
      set({ persistToStorage: true });
      savePersistedKey(get().apiKey);
    }
  },
  disablePersistence: () => {
    set({ persistToStorage: false });
    savePersistedKey("");
  },
  clear: () => {
    set({ apiKey: "", isConfigured: false });
    savePersistedKey("");
  },
}));

// 옵트인한 경우에만 시작 시 로드
if (typeof window !== "undefined") {
  try {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      useAssistConfig.setState({
        apiKey: persisted,
        isConfigured: true,
        persistToStorage: true,
      });
    }
  } catch {
    // 무시
  }
}
