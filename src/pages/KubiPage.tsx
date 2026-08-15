/**
 * Kubi 전용 화면 (`/kubi`) — placeholder (#247).
 *
 * Context-aware Kubi(탐색·분석·Action·Generated SQL)의 실제 구현은 #256에서 진행한다.
 * App Shell 단계에서는 전역 Kubi drawer(`src/features/kubi/KubiDrawer.tsx`)의 shell만
 * 준비되어 있다 — 상단 Kubi 버튼으로 어디서나 열 수 있다.
 */
import { PlaceholderPage } from "@/shared/ui";

export function KubiPage() {
  return (
    <PlaceholderPage
      eyebrow="Kubi"
      title="Kubi AI Assistant"
      description="자연어로 데이터를 탐색하고, 품질/실패를 분석하며, Generated SQL로 결과를 확인합니다."
      note="Kubi 전용 화면과 대화형 기능은 #256에서 구현됩니다. 상단 Kubi 버튼으로 여는 drawer는 지금도 어느 화면에서나 열 수 있습니다."
    />
  );
}
