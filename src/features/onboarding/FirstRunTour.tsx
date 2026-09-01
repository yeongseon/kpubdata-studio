import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/Button";

export const ONBOARDING_STORAGE_KEY = "kpubdata:onboarding:v1";

const steps = [
  { target: "sidebar", title: "작업 공간 둘러보기", copy: "왼쪽 메뉴에서 데이터 탐색, Build·Quality 확인, Kubi와 Provider 설정으로 이동할 수 있습니다." },
  { target: "workflow", title: "데이터가 이렇게 만들어집니다", copy: "데이터를 찾고 가져오기 설정을 준비한 뒤 Preview로 실제 데이터를 확인·검증하고 Build합니다. 이후 Quality 결과를 확인하고 활용할 수 있습니다." },
  { target: "start-actions", title: "여기서 시작하세요", copy: "카탈로그에서 데이터를 찾으려면 Discover, API·파일·URL을 직접 가져오려면 Add Data를 사용하세요." },
  { target: "kubi-helper", title: "막히면 Kubi에게 물어보세요", copy: "Kubi는 현재 화면의 Dataset·Run·Stage와 Builder Evidence를 바탕으로 분석을 돕습니다." },
] as const;

function hasCompletedTour() {
  try { return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete"; } catch { return false; }
}

export function resetFirstRunTour() {
  try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* storage를 사용할 수 없어도 수동 재생은 가능하다. */ }
  window.dispatchEvent(new CustomEvent("kpubdata:onboarding:replay"));
}

export function FirstRunTour() {
  const [open, setOpen] = useState(() => !hasCompletedTour());
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const replay = () => { setStep(0); setOpen(true); };
    window.addEventListener("kpubdata:onboarding:replay", replay);
    return () => window.removeEventListener("kpubdata:onboarding:replay", replay);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previousFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => setRect(document.querySelector<HTMLElement>(`[data-tour="${steps[step].target}"]`)?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, step]);

  function close() {
    try { localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete"); } catch { /* 비필수 저장소 */ }
    setOpen(false);
  }

  if (!open || typeof document === "undefined") return null;
  const width = Math.min(336, window.innerWidth - 24);
  const left = rect ? Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) : 12;
  const below = rect ? rect.bottom + 12 : 80;
  const top = Math.max(12, Math.min(below, window.innerHeight - 230));

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] bg-black/20" aria-hidden="true" />
      {rect ? <div aria-hidden="true" className="pointer-events-none fixed z-[81] rounded-xl ring-4 ring-accent ring-offset-4 ring-offset-background" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} /> : null}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="fixed z-[82] rounded-xl border border-border bg-card p-5 text-foreground shadow-xl outline-none"
        style={{ left, top, width }}
      >
        <p className="text-xs font-semibold text-accent-subtle-foreground">{step + 1} / {steps.length}</p>
        <h2 id="onboarding-title" className="mt-1 text-base font-semibold">{steps[step].title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{steps[step].copy}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={close}>건너뛰기</Button>
          <div className="flex gap-2">
            {step > 0 ? <Button variant="secondary" size="sm" onClick={() => setStep((value) => value - 1)}>이전</Button> : null}
            {step < steps.length - 1
              ? <Button size="sm" onClick={() => setStep((value) => value + 1)}>다음</Button>
              : <Button size="sm" onClick={close}>완료</Button>}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
