/**
 * Add Data Workbench 화면 (`/add`) — placeholder (#247).
 *
 * Public API·File·URL을 하나의 워크벤치에서 BuildSpec + Preview/Validation으로 이어주는
 * 실제 흐름은 #250에서 구현한다. 기존 새 빌드 작성 흐름(`/builds/new`)은 계속 동작하며,
 * 이 화면이 완성되면 그 흐름을 대체/흡수할 예정이다.
 */
import { Link } from "react-router-dom";
import { PlaceholderPage } from "@/shared/ui";

export function AddDataPage() {
  return (
    <PlaceholderPage
      eyebrow="Add Data"
      title="데이터 추가"
      description="Public API, File, URL 중 하나로 새 데이터 소스를 연결하고 BuildSpec을 만듭니다."
      note={
        <>
          Add Data Workbench는 #250에서 구현됩니다. 지금 바로 빌드를 시작하려면{" "}
          <Link to="/builds/new" className="text-accent-subtle-foreground underline">
            새 빌드 만들기
          </Link>
          를 이용하세요.
        </>
      }
    />
  );
}
