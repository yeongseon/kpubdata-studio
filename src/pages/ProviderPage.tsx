/**
 * Provider 화면 (`/provider`) — placeholder (#247).
 *
 * Provider 연결/자격 증명 관리의 실제 구현은 #259에서 진행한다.
 */
import { PlaceholderPage } from "@/shared/ui";

export function ProviderPage() {
  return (
    <PlaceholderPage
      eyebrow="Provider"
      title="Provider"
      description="데이터 제공 기관 연결과 자격 증명(credential)을 관리합니다."
      note="Provider 연결·자격 증명 관리는 #259에서 구현됩니다."
    />
  );
}
