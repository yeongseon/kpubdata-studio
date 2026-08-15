/**
 * Dataset Detail 화면 (`/datasets/:datasetId`) — placeholder (#247).
 *
 * Quality/Kubi/Reports/Publish 탭을 포함한 실제 구현은 #253(P0)과 #253의 Publish 확장(P1)에서
 * 진행한다. 여기서는 route param을 받아 어떤 데이터셋인지만 안내한다.
 */
import { useParams } from "react-router-dom";
import { PlaceholderPage } from "@/shared/ui";

export function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  return (
    <PlaceholderPage
      eyebrow="Dataset"
      title={datasetId ? `데이터셋: ${datasetId}` : "데이터셋 상세"}
      description="스키마, Quality, Kubi 분석, Reports, Publish 탭을 한 화면에서 제공합니다."
      note="Dataset Detail 화면은 #253에서 구현됩니다."
    />
  );
}
