/**
 * 상단 Kubi 자연어 검색 입력 (#247).
 *
 * 검색어를 Builder Kubi backend로 보내 후보를 추천받는 실제 연동은 #256에서 구현한다.
 * App Shell 단계에서는 제출 시 전역 Kubi drawer를 여는 진입점 역할만 한다 — hallucinated
 * dataset을 만들어내지 않도록 여기서 어떤 결과도 임의 생성하지 않는다.
 */
import { useState, type FormEvent } from "react";
import { useUIStore } from "@/shared/hooks/useUIStore";

export function KubiSearchInput() {
  const [query, setQuery] = useState("");
  const openKubiDrawer = useUIStore((state) => state.openKubiDrawer);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 실제 검색/추천은 #256에서 연결된다. 지금은 drawer를 여는 진입점만 제공한다.
    openKubiDrawer();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring sm:flex"
    >
      <span aria-hidden="true">🔍</span>
      <label className="sr-only" htmlFor="kubi-search">
        Kubi에게 자연어로 데이터 물어보기
      </label>
      <input
        className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        id="kubi-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Kubi에게 데이터에 대해 물어보세요…"
        type="search"
        value={query}
      />
    </form>
  );
}
