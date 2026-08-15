/**
 * 전역 Kubi drawer (#247, #256).
 *
 * `Layout`에서 한 번만 mount되어 어느 화면에서도 동일한 Kubi UI가 열리도록 한다(page별 중복
 * 렌더 금지). 실제 LLM 연동, Evidence/Generated SQL, Suggested Action은 `KubiContent`
 * (`useKubiSession` 공유)가 담당하고, 이 컴포넌트는 drawer 자체의 열림/닫힘·포커스 트랩만 맡는다.
 */
import { useEffect, useRef } from "react";
import { useUIStore } from "@/shared/hooks/useUIStore";
import { KubiContent } from "./KubiContent";

/**
 * 어디서나 열리는 전역 Kubi drawer.
 *
 * @returns drawer가 닫혀 있으면 `null`, 열려 있으면 현재 화면 context를 반영한 Kubi 대화 패널.
 */
export function KubiDrawer() {
  const isOpen = useUIStore((state) => state.isKubiDrawerOpen);
  const closeKubiDrawer = useUIStore((state) => state.closeKubiDrawer);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // 열리는 순간 닫기 버튼으로 포커스를 옮기고, 모달 안에서 포커스를 순환시킨다.
  // 닫히면 drawer를 열었던 요소로 포커스를 되돌린다(접근성).
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeKubiDrawer();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, closeKubiDrawer]);

  if (!isOpen) return null;

  return (
    <>
      {/* 클릭 전용 overlay — 탭 순서/접근성 트리에서 제외(ESC·닫기 버튼이 AT 대안).
          aria-hidden이므로 라벨을 넣지 않는다. */}
      <button
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-zinc-950/45"
        data-testid="kubi-drawer-overlay"
        onClick={closeKubiDrawer}
        tabIndex={-1}
        type="button"
      />
      <aside
        ref={dialogRef}
        aria-label="Kubi AI Assistant"
        aria-modal="true"
        role="dialog"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card px-5 py-5 shadow-xl sm:w-96"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ✨ Kubi AI Assistant
          </p>
          <button
            ref={closeButtonRef}
            aria-label="Kubi 닫기"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={closeKubiDrawer}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1">
          <KubiContent compact />
        </div>
      </aside>
    </>
  );
}
