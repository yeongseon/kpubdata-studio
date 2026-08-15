/**
 * Workspace 화면 (`/workspace`) — placeholder (#247).
 *
 * Recent Work와 저장된 BuildSpec 작업대는 #260에서 구현한다. 기존 `features/workspace`의
 * 개인/팀 워크스페이스 전환(Settings)과는 별개 개념이다 — 여기서는 새 IA의 "작업대" 화면을
 * 가리킨다.
 */
import { PlaceholderPage } from "@/shared/ui";

export function WorkspacePage() {
  return (
    <PlaceholderPage
      eyebrow="Workspace"
      title="작업대"
      description="최근 작업(Recent Work)과 저장한 BuildSpec을 한 곳에서 관리합니다."
      note="Workspace / Saved BuildSpecs 화면은 #260에서 구현됩니다."
    />
  );
}
