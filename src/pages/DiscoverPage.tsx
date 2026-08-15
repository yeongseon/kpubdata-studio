/**
 * Discover 화면 (`/discover`) — placeholder (#247).
 *
 * 정확 검색과 Provider 탐색 UI는 #249에서 구현한다. App Shell 단계에서는 새 IA의 route와
 * 내비게이션이 먼저 존재해야 하므로 명시적인 placeholder를 둔다.
 */
import { PlaceholderPage } from "@/shared/ui";

export function DiscoverPage() {
  return (
    <PlaceholderPage
      eyebrow="Discover"
      title="데이터 탐색"
      description="Provider와 데이터셋을 정확 검색하고 후보를 추천받습니다."
      note="정확 검색·Provider 탐색 UI는 #249에서 구현됩니다."
    />
  );
}
