/**
 * 빌드 결과물 페이지 (/builds/:buildId/artifacts).
 *
 * manifest 요약, 생성 파일 목록, manifest 원본(JSON)을 보여준다(제안 §5.7, #30).
 * 현재 manifest는 mock이며 #29 Builder API 연동 시 실제 데이터로 교체된다.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getBuildManifest } from "@/features/artifacts/api";
import type { BuildManifest } from "@/shared/lib/types";
import { Card, EmptyState, ErrorState, LinkButton, PageHeader, SkeletonTable } from "@/shared/ui";

interface ManifestState {
  status: "loading" | "loaded" | "error";
  manifest?: BuildManifest;
  error?: string;
}

/** 파일 경로에서 표시용 이름과 형식(확장자)을 뽑는다. */
function describeFile(path: string): { name: string; format: string } {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return { name, format: dot >= 0 ? name.slice(dot + 1) : "—" };
}

/**
 * 빌드가 생성한 결과물과 manifest 요약을 보여주는 페이지.
 *
 * @returns 결과물 화면.
 */
export function BuildArtifactsPage() {
  const { buildId = "" } = useParams();
  const [state, setState] = useState<ManifestState>({ status: "loading" });

  const load = useCallback(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    getBuildManifest(buildId, controller.signal)
      .then((manifest) => {
        if (!controller.signal.aborted) setState({ status: "loaded", manifest });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "manifest를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [buildId]);

  useEffect(() => load(), [load]);

  const manifest = state.manifest;
  const formats = manifest
    ? [...new Set(manifest.outputs.map((path) => describeFile(path).format))]
    : [];
  
  const hasMetadata = manifest && manifest.started_at && manifest.started_at.length > 0;
  const totalRecords = manifest && hasMetadata
    ? Object.values(manifest.row_counts).reduce((sum, count) => sum + count, 0)
    : null;
  const sources = manifest && hasMetadata && manifest.provenance.length > 0
    ? manifest.provenance.map((p) => `${p.provider}.${p.dataset}`).join(", ")
    : null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="결과물"
        title={`${buildId || "빌드"} 결과물`}
        description="빌드가 생성한 파일, manifest, 다운로드 링크를 확인하세요."
        actions={<LinkButton to={`/builds/${buildId}/publish`}>게시하기</LinkButton>}
      />

      {state.status === "loading" ? (
        <Card className="p-0">
          <SkeletonTable rows={4} />
        </Card>
      ) : null}

      {state.status === "error" ? (
        <Card variant="error" className="p-0">
          <ErrorState
            title="결과물을 불러오지 못했습니다"
            message={state.error}
            onRetry={() => load()}
          />
        </Card>
      ) : null}

      {state.status === "loaded" && manifest ? (
        <>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Manifest 요약
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">레코드 수</dt>
                <dd className="text-foreground">
                  {totalRecords !== null ? totalRecords.toLocaleString("ko-KR") : "미제공"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">출력 형식</dt>
                <dd className="text-foreground">{formats.length > 0 ? formats.join(", ") : "미제공"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">소스</dt>
                <dd className="text-foreground">
                  {sources || "미제공"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">빌드 ID</dt>
                <dd className="break-all text-foreground">{manifest?.build_id || "미제공"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-0">
            <div className="grid grid-cols-[1.6fr_0.6fr_0.8fr] gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>파일</span>
              <span>형식</span>
              <span>액션</span>
            </div>
            {manifest.outputs.length === 0 ? (
              <EmptyState title="생성된 파일이 없습니다" />
            ) : (
              <ul>
                {manifest.outputs.map((path) => {
                  const { name, format } = describeFile(path);
                  return (
                    <li
                      key={path}
                      className="grid grid-cols-[1.6fr_0.6fr_0.8fr] items-center gap-4 border-b border-border px-6 py-3 text-sm last:border-0 "
                    >
                      <span className="break-all font-medium">{name}</span>
                      <span className="uppercase text-muted-foreground">{format}</span>
                      <span className="text-muted-foreground">다운로드(연동 예정)</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              manifest.json
            </p>
            {!hasMetadata && (
              <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                실연동 모드에서는 Builder /build 응답 manifest가 아직 연동되지 않아, 
                메타데이터 필드(시간/환경/지문/레코드 수/스키마/출처)가 제공되지 않습니다. 
                파일 목록(outputs)만 실제 데이터입니다.
              </p>
            )}
            <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              <code>{JSON.stringify(manifest, null, 2)}</code>
            </pre>
          </Card>
        </>
      ) : null}
    </main>
  );
}
