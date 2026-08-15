/**
 * Kubi 전용 화면 (`/kubi`, #256).
 *
 * 전역 drawer(`src/features/kubi/KubiDrawer.tsx`)와 같은 `useKubiSession` 대화를 공유한다 —
 * 별도 Kubi 시스템이 아니라 같은 상태를 더 넓은 레이아웃으로 보여주는 화면이다.
 */
import { KubiContent } from "@/features/kubi/KubiContent";
import { PageHeader } from "@/shared/ui";

export function KubiPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Kubi"
        title="Kubi · AI Data Copilot"
        description="현재 화면·Dataset·Build·Quality 문맥을 사용해 Evidence 기반 답변과 다음 Action까지 연결합니다."
      />
      <KubiContent />
    </main>
  );
}
