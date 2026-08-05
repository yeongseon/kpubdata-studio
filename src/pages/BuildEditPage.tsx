/**
 * 빌드 스펙 편집 페이지.
 *
 * 기존 빌드 스펙을 로드하여 수정하고 Builder POST /validate로 검증한 후 저장한다.
 * BuildEdit/Detail/Publish 화면 실장 (#120, #156)의 일부.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader, Card } from "@/shared/ui";
import { SpecEditor } from "@/features/build-spec/components/SpecEditor";
import type { BuildSpec } from "@/shared/lib/types";

interface BuildDetail {
  id: string;
  spec: BuildSpec;
  status: string;
  startedAt: string;
  finishedAt?: string;
}

interface EditorState {
  status: "loading" | "loaded" | "error";
  buildDetail?: BuildDetail;
  error?: string;
}

export function BuildEditPage() {
  const { buildId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<EditorState>({ status: "loading" });
  const [isSaving, setIsSaving] = useState(false);

  const loadBuildDetail = useCallback(async () => {
    if (!buildId) {
      setState({ status: "error", error: "빌드 ID가 필요합니다." });
      return;
    }

    setState({ status: "loading" });
    try {
      // TODO: 실제 Builder API 연동 시 Builder GET /builds/:id 또는 유사 엔드포인트로 대체
      // 현재는 mock 데이터 사용
      const mockBuildDetail: BuildDetail = {
        id: buildId,
        spec: {
          datasetId: "datago-air-quality",
          title: "대기오염 정보",
          description: "data.go.kr 대기오염 측정 데이터셋",
          sources: [
            { provider: "datago", dataset: "air-quality", params: { sidoName: "서울" } },
          ],
          exports: [{ format: "jsonl" }],
          metadata: { outputPath: "artifacts/builds/air-quality" },
        },
        status: "succeeded",
        startedAt: "2024-08-04T10:00:00Z",
        finishedAt: "2024-08-04T10:05:00Z",
      };

      setState({ status: "loaded", buildDetail: mockBuildDetail });
    } catch (cause) {
      setState({
        status: "error",
        error: cause instanceof Error ? cause.message : "빌드 정보를 불러오지 못했습니다.",
      });
    }
  }, [buildId]);

  useEffect(() => {
    loadBuildDetail();
  }, [loadBuildDetail]);

  const handleSave = useCallback(async (spec: BuildSpec) => {
    setIsSaving(true);
    try {
      // TODO: 실제 Builder API 연동 시 Builder POST /builds/:id 또는 유사 엔드포인트로 대체
      console.log("Saving build spec:", spec);
      // 현재는 성공한 것으로 처리
      navigate(`/builds/${buildId}`);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [buildId, navigate]);

  const handleCancel = useCallback(() => {
    navigate(`/builds/${buildId}`);
  }, [buildId, navigate]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="빌드 편집"
        title={`빌드 ${buildId} 편집`}
        description="빌드 스펙을 수정하고 검증하세요."
        actions={
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            취소
          </button>
        }
      />

      {state.status === "loading" && (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">로딩 중...</div>
        </Card>
      )}

      {state.status === "error" && (
        <Card variant="error" className="p-8">
          <div className="text-center text-red-600 dark:text-red-400">
            {state.error ?? "빌드 정보를 불러오지 못했습니다."}
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadBuildDetail}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              다시 시도
            </button>
          </div>
        </Card>
      )}

      {state.status === "loaded" && state.buildDetail && (
        <SpecEditor
          mode="edit"
          initialSpec={state.buildDetail.spec}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
    </main>
  );
}