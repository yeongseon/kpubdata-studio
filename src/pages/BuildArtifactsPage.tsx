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
  // Builder는 소스별 row_counts(dict)를 주므로 UI 요약에서는 합계로 보여준다.
  const totalRecords = manifest
    ? Object.values(manifest.row_counts).reduce((sum, count) => sum + count, 0)
    : 0;

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
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              Manifest 요약
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">레코드 수</dt>
                <dd className="text-zinc-800 dark:text-zinc-100">
                  {totalRecords.toLocaleString("ko-KR")}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">출력 형식</dt>
                <dd className="text-zinc-800 dark:text-zinc-100">{formats.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">소스</dt>
                <dd className="text-zinc-800 dark:text-zinc-100">
                  {manifest.provenance.map((p) => `${p.provider}.${p.dataset}`).join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">빌드 ID</dt>
                <dd className="break-all text-zinc-800 dark:text-zinc-100">{manifest.build_id}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-0">
            <div className="grid grid-cols-[1.6fr_0.6fr_0.8fr] gap-4 border-b border-zinc-200/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
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
                      className="grid grid-cols-[1.6fr_0.6fr_0.8fr] items-center gap-4 border-b border-zinc-100 px-6 py-3 text-sm last:border-0 dark:border-zinc-900"
                    >
                      <span className="break-all font-medium">{name}</span>
                      <span className="uppercase text-zinc-500 dark:text-zinc-400">{format}</span>
                      <span className="text-zinc-400 dark:text-zinc-500">다운로드(연동 예정)</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              manifest.json
            </p>
            <pre className="mt-4 overflow-x-auto rounded-[1.5rem] bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              <code>{JSON.stringify(manifest, null, 2)}</code>
            </pre>
          </Card>
        </>
      ) : null}
    </main>
  );
}
