/**
 * 전역 Kubi drawer (#247).
 *
 * `Layout`에서 한 번만 mount되어 어느 화면에서도 동일한 Kubi UI가 열리도록 한다(page별 중복
 * 렌더 금지). 실제 LLM 연동, 자연어 탐색, Evidence/Generated SQL, Suggested Action은
 * #256에서 구현하며, 여기서는 현재 라우트 context를 반영하는 shell만 제공한다.
 *
 * context는 `resolveKubiRouteContext`로 매 렌더마다 현재 pathname에서 다시 계산하므로,
 * drawer를 연 채로 다른 화면으로 이동해도 표시되는 화면 이름이 항상 최신 상태를 따라간다.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUIStore } from "@/shared/hooks/useUIStore";
import { resolveKubiRouteContext } from "./context";

/**
 * 어디서나 열리는 전역 Kubi drawer.
 *
 * @returns drawer가 닫혀 있으면 `null`, 열려 있으면 현재 화면 context를 보여주는 패널.
 */
export function KubiDrawer() {
  const isOpen = useUIStore((state) => state.isKubiDrawerOpen);
  const closeKubiDrawer = useUIStore((state) => state.closeKubiDrawer);
  const { pathname } = useLocation();
  const context = resolveKubiRouteContext(pathname);
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
      <button
        aria-label="Kubi 닫기"
        className="fixed inset-0 z-40 bg-zinc-950/45"
        onClick={closeKubiDrawer}
        type="button"
      />
      <aside
        ref={dialogRef}
        aria-label="Kubi AI Assistant"
        aria-modal="true"
        role="dialog"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card px-5 py-5 shadow-xl sm:w-96"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kubi AI Assistant
            </p>
            <p className="mt-1 text-sm text-foreground">{context.pageLabel} 화면 문맥</p>
          </div>
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

        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Kubi는 아직 준비 중입니다</p>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            자연어 탐색, 품질/실패 분석, Generated SQL, Suggested Action은 #256에서 이 drawer에
            연결됩니다.
          </p>
        </div>
      </aside>
    </>
  );
}
