/**
 * Add Data 4단계 — Review & Build (#250).
 *
 * 표시되는 "실제 제출될 canonical BuildSpec"은 `toBuilderSpec(spec)`을 그대로
 * pretty-print한 것이다 — Build 제출에 쓰는 `serializeSpec`(compact JSON)과 같은
 * `toBuilderSpec` 호출 결과이므로 표시값과 제출값이 절대 갈라지지 않는다
 * (#250 amendment 1). stale preview(직전 Preview 이후 spec/옵션이 바뀜)면 Build를 막는다.
 *
 * 예외 두 가지(#283 리뷰 대응, Epic #246, 후속 리뷰 §1): url source의 endpoint,
 * public_api source의 sourceParams는 secret query/param(`api_key`/`serviceKey`/
 * `token`/`secret`, 고엔트로피 값)을 담을 수 있어 `redactBuildSpecForDisplay`/
 * `redactSourceParamsText`로 화면 표시 사본만 별도로 만든다 — 실제 Build 제출은
 * (`AddDataPage`의 onBuild → `job.start(specResult.spec)`) 이 컴포넌트를 거치지 않고
 * 원문 spec을 그대로 쓰므로, 표시용 redaction이 제출값에 영향을 주지 않는다.
 */
import { toBuilderSpec } from "@/features/build-spec/specMapping";
import { PREVIEW_SOURCE_STATE_LABEL, summarizeChecksPassed, summarizePreviewSources } from "@/features/quality/model";
import { QualityBadge } from "@/features/quality/QualityBadge";
import { redactBuildSpecForDisplay } from "@/features/add-data/model";
import { redactUrlEndpoint } from "@/features/add-data/urlRedaction";
import { redactSourceParamsText } from "@/features/add-data/paramsRedaction";
import type { PreviewSource } from "@/shared/lib/builderApi";
import type { BuildJobStatus } from "@/features/runs/useBuildJob";
import type { AddDataDraft, PreviewLimit, PreviewSampleMode } from "@/features/add-data/model";
import type { BuildSpec } from "@/shared/lib/types";
import { Button, Card } from "@/shared/ui";

export interface ReviewBuildStepProps {
  draft: AddDataDraft;
  spec?: BuildSpec;
  specError?: string;
  validation: { status: "idle" | "validating" | "validated"; valid: boolean; errors: string[] };
  /** Builder /preview가 반환한 모든 source(#250 §3) — 첫 항목만 쓰지 않는다. */
  previewSources: PreviewSource[];
  previewLimit: PreviewLimit;
  previewSampleMode: PreviewSampleMode;
  isStale: boolean;
  jobStatus: BuildJobStatus;
  jobError?: string;
  /** 사용자가 진행 중인 요청을 클라이언트에서 중단함(서버 실행 결과 미확인, sync build). */
  jobInterrupted?: boolean;
  runId?: string;
  onBuild: () => void;
  onCancel: () => void;
}

// 표시 전용 — sourceSummary/querySummary는 실제 Builder 제출값이 아니라 사람이 읽는
// Review 요약이므로 secret query parameter를 redact한 endpoint를 쓴다(#283 리뷰
// 대응, Epic #246). 실제 제출은 이 함수들을 거치지 않는다.
function sourceSummary(draft: AddDataDraft): string {
  if (draft.sourceKind === "public_api") return `Public API · ${draft.publicApi.provider}/${draft.publicApi.dataset}`;
  if (draft.sourceKind === "file") return `File Upload · ${draft.file.filename ?? draft.file.format ?? ""}`;
  if (draft.sourceKind === "url") return `URL / REST API · ${redactUrlEndpoint(draft.url.endpoint).endpoint}`;
  return "선택되지 않음";
}

function querySummary(draft: AddDataDraft): string {
  if (draft.sourceKind === "public_api") return redactSourceParamsText(draft.publicApi.sourceParams).text;
  if (draft.sourceKind === "file") return `${draft.file.format ?? "—"} · ${draft.file.encoding}`;
  if (draft.sourceKind === "url") return redactUrlEndpoint(draft.url.endpoint).endpoint || "—";
  return "—";
}

const PIPELINE_STAGES = ["Bronze", "Validate", "Silver", "Gold"] as const;

/**
 * Pipeline stage-flow 표시용 상태(Prototype `reviewBuild()`의 stage-flow와 동일 발상).
 * Studio는 useBuildJob에서 stage 단위 진행률을 받지 않으므로, 실제로 아는 것(build job 전체
 * 상태)만 정직하게 반영한다 — 가짜 세부 진행률을 지어내지 않는다.
 */
function pipelineStageStatus(jobStatus: BuildJobStatus): string {
  if (jobStatus === "succeeded") return "Done";
  if (jobStatus === "failed") return "중단";
  if (jobStatus === "running") return "진행 중";
  return "Pending";
}

export function ReviewBuildStep({
  draft,
  spec,
  specError,
  validation,
  previewSources,
  previewLimit,
  previewSampleMode,
  isStale,
  jobStatus,
  jobError,
  jobInterrupted,
  runId,
  onBuild,
  onCancel,
}: ReviewBuildStepProps) {
  // 실제 제출은 항상 원문 `spec`으로 이뤄진다(AddDataPage의 onBuild가 이 컴포넌트가
  // 아니라 자신의 specResult.spec을 그대로 job.start에 넘긴다) — 여기서 만드는
  // displaySpec은 화면 표시 전용 사본이며, redact 여부가 실제 제출값에 전혀 영향을
  // 주지 않는다(#283 리뷰 대응, Epic #246).
  const displaySpec = spec ? redactBuildSpecForDisplay(spec) : null;
  const displaySubmissionSpec = displaySpec ? toBuilderSpec(displaySpec) : null;
  // 여러 source의 quality_results를 합쳐 하나의 PASS로 지어내지 않는다 — Builder가
  // 실제로 반환한 결과를 그대로 합산(pass/warn/fail 카운트)하고, source별 상태가 갈리면
  // mixed로 표시한다(#250 §3).
  const totalRows = previewSources.length > 0 ? previewSources[0].total_rows : undefined;
  const previewsSummary = summarizePreviewSources(previewSources);
  const quality = previewSources.length > 0
    ? summarizeChecksPassed(previewSources.flatMap((s) => s.quality_results))
    : null;
  const canBuild =
    Boolean(spec) &&
    validation.status === "validated" &&
    validation.valid &&
    !isStale &&
    jobStatus !== "running";

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight">검토 · Build</h3>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">데이터셋</p>
          <p className="mt-1 text-base font-semibold">{draft.title || draft.datasetId || "—"}</p>
          <p className="text-xs text-muted-foreground">{sourceSummary(draft)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Preview 조건</p>
          <p className="mt-1 text-base font-semibold">{previewLimit} rows · {previewSampleMode}</p>
          <p className="text-xs text-muted-foreground">
            {previewSources.length > 0
              ? previewSources.length > 1
                ? `${previewSources.length}개 source 표본${previewsSummary.mixed ? " · mixed" : ""}`
                : `${totalRows}건 중 표본`
              : "미실행"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">검증 결과</p>
          <p className="mt-1 text-base font-semibold">
            {validation.status !== "validated" ? "미실행" : validation.valid ? "통과" : "실패"}
          </p>
          {quality ? <QualityBadge status={quality.status} /> : <p className="text-xs text-muted-foreground">품질 결과 없음</p>}
          {previewsSummary.mixed ? (
            <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Mixed — source별 상태가 다릅니다
            </p>
          ) : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">출력</p>
          <p className="mt-1 text-base font-semibold">{draft.exportFormats.join(", ").toUpperCase() || "—"}</p>
          <p className="text-xs text-muted-foreground">Bronze → Silver → Gold</p>
        </Card>
      </div>

      {isStale ? (
        <Card variant="error" className="p-4">
          <p role="alert" className="text-sm text-red-800 dark:text-red-200">
            Preview 실행 이후 source/설정이 변경되어 이전 Preview·Validation 결과를 재사용할 수 없습니다.
            Preview & Validate 단계에서 다시 실행해주세요.
          </p>
        </Card>
      ) : null}

      {!validation.valid && validation.status === "validated" ? (
        <Card variant="error" className="p-4">
          <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
            {validation.errors.map((err, i) => (
              <li key={i} role="alert">{err}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {specError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{specError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-sm font-semibold">Build plan</p>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Source / Provider", sourceSummary(draft)],
              ["Dataset", draft.title || draft.datasetId || "—"],
              ["Query / Config", querySummary(draft)],
              [
                "Preview",
                previewSources.length > 0
                  ? previewSources.length > 1
                    ? `${previewLimit} rows(${previewSampleMode}) · ${previewSources.length}개 source${previewsSummary.mixed ? " (mixed)" : ""}`
                    : `${previewLimit} rows(${previewSampleMode}) · ${totalRows}건 중 표본`
                  : "미실행",
              ],
              ["Validation", quality ? `${quality.pass}/${quality.evaluated} · ${quality.status}` : "미실행"],
              ["Output", draft.exportFormats.join(", ").toUpperCase() || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </dl>
          {previewSources.length > 1 ? (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-sm font-semibold">Source별 Preview/Validation</p>
              {previewsSummary.perSource.map(({ source: s, state, quality: q }) => (
                <div key={s.source_key} className="flex items-center justify-between text-sm">
                  <span>{s.source_key}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {PREVIEW_SOURCE_STATE_LABEL[state]}
                    {q.evaluated > 0 ? <QualityBadge status={q.status} /> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="border-t border-border pt-3">
            <p className="text-sm font-semibold">Pipeline</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-muted-foreground">Source</p>
                <p className="font-semibold">{jobStatus === "succeeded" ? "Done" : "Ready"}</p>
              </div>
              {PIPELINE_STAGES.map((stage) => (
                <span key={stage} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">→</span>
                  <span className="rounded-lg border border-border bg-card px-3 py-2">
                    <span className="block text-muted-foreground">{stage}</span>
                    <span className="block font-semibold">{pipelineStageStatus(jobStatus)}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-semibold">실제 제출될 canonical BuildSpec</p>
          <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
            <code>{displaySubmissionSpec ? JSON.stringify(displaySubmissionSpec, null, 2) : "스펙을 아직 만들 수 없습니다."}</code>
          </pre>
          <p className="text-xs text-muted-foreground">
            Build 시작 후 동일한 설정·검증 결과가 Run 상세에 그대로 이어집니다. URL source의 secret
            query parameter, Public API source의 secret 파라미터 값은 표시에서만 가려지며, 실제
            제출값에는 영향을 주지 않습니다.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canBuild} loading={jobStatus === "running"} onClick={onBuild}>
          Build 시작
        </Button>
        {jobStatus === "running" ? (
          <Button variant="secondary" onClick={onCancel}>취소</Button>
        ) : null}
        {jobStatus === "succeeded" && runId ? (
          <span className="text-sm text-accent-subtle-foreground">빌드 성공 (run {runId})</span>
        ) : null}
        {jobStatus === "failed" ? (
          <span role="alert" className="text-sm text-red-700 dark:text-red-300">{jobError}</span>
        ) : null}
        {jobStatus === "cancelled" ? (
          <span className="text-sm text-muted-foreground">실행이 취소되었습니다.</span>
        ) : null}
        {jobInterrupted && jobStatus !== "cancelled" ? (
          <span className="text-sm text-muted-foreground">
            요청을 중단했습니다. 서버 빌드 결과는 확인되지 않았습니다.
          </span>
        ) : null}
      </div>
    </div>
  );
}
