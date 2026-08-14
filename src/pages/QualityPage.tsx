/**
 * Quality Center 화면 (`/quality`) — placeholder (#247).
 *
 * 실제 Quality Center 구현은 #254에서 진행한다. Studio는 PASS/WARN/FAIL 결과를 임의로
 * 생성하지 않고 Builder 결과를 그대로 드러낸다는 원칙(#246)을 유지한다.
 */
import { PlaceholderPage } from "@/shared/ui";

export function QualityPage() {
  return (
    <PlaceholderPage
      eyebrow="Quality"
      title="품질 센터"
      description="빌드·데이터셋의 품질 결과(PASS/WARN/FAIL)를 한 곳에서 확인합니다."
      note="Quality Center는 #254에서 구현됩니다."
    />
  );
}
