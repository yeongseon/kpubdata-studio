/**
 * 빌드 상세 요약 페이지 (/builds/:buildId).
 *
 * 빌드의 현재 상태와 편집/실행/결과물/게시로 이어지는 하위 흐름 진입점을 보여준다.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, LinkButton, PageHeader, Skeleton, StatusBadge } from "@/shared/ui";
import { getBuildManifest } from "@/features/artifacts/api";
import type { BuildManifest } from "@/shared/lib/types";
import { useBuild } from "@/features/runs/useBuild";

const SUBPAGES = [
  { segment: "edit", label: "편집", description: "스펙 수정" },
  { segment: "run", label: "실행", description: "빌드 실행 및 추적" },
  { segment: "artifacts", label: "결과물", description: "파일과 manifest 확인" },
  { segment: "publish", label: "게시", description: "배포 전 검토 및 publish" },
] as const;

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
 * 빌드 상세 요약과 하위 흐름 진입 카드를 보여주는 페이지.
 *
 * @returns 빌드 상세 화면.
 */
export function BuildDetailPage() {
  const { buildId = "" } = useParams();
  const { build, isLoading, error } = useBuild(buildId);
  const [manifestState, setManifestState] = useState<ManifestState>({ status: "loading" });

  const loadManifest = useCallback(() => {
    const controller = new AbortController();
    setManifestState({ status: "loading" });
    getBuildManifest(buildId, controller.signal)
      .then((manifest) => {
        if (!controller.signal.aborted) setManifestState({ status: "loaded", manifest });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setManifestState({
          status: "error",
          error: cause instanceof Error ? cause.message : "manifest를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [buildId]);

  // build 조회 성공 시 manifest를 로드한다.
  useEffect(() => {
    if (build && !isLoading && !error) {
      return loadManifest();
    }
  }, [build, isLoading, error, loadManifest]);

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <PageHeader
          eyebrow="빌드 상세"
          title={buildId || "빌드"}
          description="빌드 정보를 불러오는 중..."
        />
        <Card className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </Card>
      </main>
    );
  }

  if (error || !build) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <PageHeader
          eyebrow="빌드 상세"
          title={buildId || "빌드"}
          description="빌드 정보를 불러오지 못했습니다."
        />
        <Card className="text-red-700 dark:text-red-300">
          {error || "빌드를 찾을 수 없습니다."}
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      {/* 제목은 스펙의 title을 쓰되, 어떤 실행인지 식별할 수 있도록 run id를 함께 노출한다. */}
      <PageHeader
        eyebrow={`빌드 상세 · ${buildId}`}
        title={build.spec.title || buildId}
        description={
          build.spec.description ||
          "이 빌드의 상태를 확인하고 편집·실행·결과물·게시 단계로 이동하세요."
        }
        actions={<LinkButton to={`/builds/${buildId}/run`}>실행하기</LinkButton>}
      />

      {/* 값이 없는 시각은 빈 span으로 자리를 차지하지 않도록 아예 렌더하지 않는다. */}
      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">현재 상태</span>
        <StatusBadge status={build.status} />
        {build.startedAt ? (
          <span className="text-sm text-muted-foreground">
            시작: {new Date(build.startedAt).toLocaleString("ko-KR")}
          </span>
        ) : null}
        {build.finishedAt ? (
          <span className="text-sm text-muted-foreground">
            완료: {new Date(build.finishedAt).toLocaleString("ko-KR")}
          </span>
        ) : null}
      </Card>

      {/* Manifest 요약 */}
      {manifestState.status === "loading" ? (
        <Card>
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : manifestState.status === "error" ? (
        <Card variant="error" className="text-red-700 dark:text-red-300">
          Manifest를 불러오지 못했습니다: {manifestState.error}
        </Card>
      ) : manifestState.manifest ? (
        <>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Manifest 요약
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">빌드 ID</dt>
                <dd className="break-all text-foreground">{manifestState.manifest.build_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">레코드 수</dt>
                <dd className="text-foreground">
                  {manifestState.manifest.row_counts && Object.keys(manifestState.manifest.row_counts).length > 0
                    ? Object.values(manifestState.manifest.row_counts)
                        .reduce((sum, count) => sum + count, 0)
                        .toLocaleString("ko-KR")
                    : "미제공"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">데이터 소스</dt>
                <dd className="text-foreground">
                  {manifestState.manifest.provenance && manifestState.manifest.provenance.length > 0
                    ? manifestState.manifest.provenance
                        .map((p) => `${p.provider}.${p.dataset}`)
                        .join(", ")
                    : "미제공"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">생성 파일 수</dt>
                <dd className="text-foreground">
                  {manifestState.manifest.outputs?.length ?? 0}
                </dd>
              </div>
            </dl>
          </Card>

          {manifestState.manifest.outputs && manifestState.manifest.outputs.length > 0 && (
            <Card className="p-0">
              <div className="grid grid-cols-[1.6fr_0.6fr] gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>파일</span>
                <span>형식</span>
              </div>
              <ul>
                {manifestState.manifest.outputs.map((path) => {
                  const { name, format } = describeFile(path);
                  return (
                    <li
                      key={path}
                      className="grid grid-cols-[1.6fr_0.6fr] items-center gap-4 border-b border-border px-6 py-3 text-sm last:border-0"
                    >
                      <span className="break-all font-medium">{name}</span>
                      <span className="uppercase text-muted-foreground">{format}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        {SUBPAGES.map((sub) => (
          <Link
            key={sub.segment}
            to={`/builds/${buildId}/${sub.segment}`}
            className="rounded-xl border border-border bg-card p-5 transition hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-base font-semibold tracking-tight">{sub.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sub.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
