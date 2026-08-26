/**
 * 빌드 실행 추적 페이지 (/builds/:buildId/run).
 *
 * 이전에는 buildId와 무관하게 항상 "대기(queued)"·0번째 stepper를 보여주는 정적
 * placeholder였다 — Builds 목록에서 running인 run을 열어도 이 화면은 항상 waiting으로
 * 보여 같은 run이 화면마다 모순된 상태를 표시했다(UI audit #3). Builder는 stage별 세부
 * 진행률/로그 API를 아직 제공하지 않으므로, 있지도 않은 진행률을 재현하는 대신 Builds
 * 목록/상세(BuildsPage)와 동일한 canonical 상태(historical summary + live job polling)만
 * 보여주고, 지원되지 않는 부분은 "상세 진행 정보 미지원"으로 명확히 구분한다.
 */
import { useParams } from "react-router-dom";
import { useSelectedRunPolling } from "@/features/runs/useSelectedRunPolling";
import { useBuild } from "@/features/runs/useBuild";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";
import type { BuildRunStatus } from "@/shared/lib/types";
import { Button, Card, EmptyState, LinkButton, PageHeader, Skeleton, StatusBadge } from "@/shared/ui";

/**
 * 빌드 실행의 canonical 상태를 추적하는 페이지.
 *
 * @returns 실행 상태 화면.
 */
export function BuildRunPage() {
  const { buildId = "" } = useParams();

  // historical: Builds 목록/편집과 같은 getBuild() 조회(mock 모드는 결정적 mock, 실연동은
  // Builder 이력 + Studio가 보관한 스펙).
  const { build, isLoading: historicalLoading, error: historicalError } = useBuild(buildId);

  // live: registry에 살아있는 job이 있으면(#245/#255) 그 상태가 가장 최신이다 — Builds
  // 상세(BuildsPage)와 동일한 hook을 재사용해 두 화면이 같은 canonical run state를 쓰게 한다.
  // mock 모드는 getBuildJob이 항상 실패하는 stub이라(#255 §3 주석 참고) live polling 자체를
  // 켜지 않고, 위 historical(deterministic mock) 상태를 그대로 신뢰한다.
  const live = useSelectedRunPolling(isRealBuilderEnabled() ? buildId || null : null);

  const runStatus: BuildRunStatus | undefined =
    live.kind === "job" ? live.job.status : build?.status;

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="실행"
        title={`${buildId || "빌드"} 실행`}
        description="Builds 목록/상세와 동일한 run 상태를 보여줍니다."
        actions={
          <Button variant="secondary" disabled>
            취소
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">상태</span>
        {historicalLoading && live.kind !== "job" ? (
          <Skeleton className="h-6 w-20" />
        ) : runStatus ? (
          <StatusBadge status={runStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">
            {historicalError ?? "상태 불명"}
          </span>
        )}
        {live.kind === "job" && (live.job.status === "queued" || live.job.status === "running" || live.job.status === "cancelling") ? (
          <span className="text-xs text-muted-foreground">실시간 갱신 중…</span>
        ) : null}
        {live.kind === "error" ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            실시간 상태 갱신 실패(일시적) — 마지막으로 확인된 상태를 유지합니다.
          </span>
        ) : null}
        {live.kind === "permission_denied" ? (
          <span className="text-xs text-red-700 dark:text-red-400">
            이 Run의 실시간 상태를 조회할 권한이 없습니다 — 마지막으로 확인된 상태를 대신 표시합니다.
          </span>
        ) : null}
      </Card>

      <Card variant="dashed" className="p-0">
        <EmptyState
          title="상세 진행 정보 미지원"
          description="Builder는 이 화면에서 stage별 세부 진행률·실행 로그 API를 아직 제공하지 않습니다(#39). 위 상태 배지가 이 run의 canonical 상태이며, stage별 진행(Bronze/Silver/Gold)은 Build 상세의 Pipeline / Stage Progress에서 확인할 수 있습니다."
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        <LinkButton variant="secondary" to={`/builds?run=${encodeURIComponent(buildId)}`}>
          Build 상세 보기
        </LinkButton>
        <LinkButton variant="secondary" to={`/builds/${buildId}/artifacts`}>
          결과물 보기
        </LinkButton>
        <LinkButton variant="ghost" to={`/builds/${buildId}/edit`}>
          스펙 수정
        </LinkButton>
      </div>
    </main>
  );
}
