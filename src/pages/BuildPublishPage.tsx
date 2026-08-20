import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getDataset, listDatasetRuns } from "@/features/datasets/api";
import {
  describePublishFailure,
  getPublishReadiness,
  isSafePublishReference,
  validatePublishDestination,
  type PublishReadinessResponse,
  type PublishRequest,
} from "@/features/publish/api";
import { usePublishJob } from "@/features/publish/usePublishJob";
import { formatDateTime } from "@/features/datasets/model";
import { Button, Card, PageHeader, Skeleton, StatusBadge } from "@/shared/ui";

type ReadinessState =
  | { status: "loading" }
  | { status: "loaded"; data: PublishReadinessResponse }
  | { status: "error"; message: string };

interface DatasetContext {
  title: string;
  finishedAt: string | null;
}

const inputClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BuildPublishPage() {
  const { buildId: runId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get("dataset") ?? "";
  const [datasetContext, setDatasetContext] = useState<DatasetContext>();
  const [readiness, setReadiness] = useState<ReadinessState>({ status: "loading" });
  const [readinessVersion, setReadinessVersion] = useState(0);
  const [destination, setDestination] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [confirmation, setConfirmation] = useState<PublishRequest>();
  const publish = usePublishJob();

  useEffect(() => {
    if (!datasetId || !runId) {
      setDatasetContext(undefined);
      return;
    }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getDataset(datasetId, controller.signal),
      listDatasetRuns(datasetId, 50, controller.signal),
    ]).then(([dataset, runs]) => {
      if (!active) return;
      const run = runs.runs.find((item) => item.run_id === runId);
      if (!run) return;
      setDatasetContext({ title: dataset.title, finishedAt: run.finished_at });
    }).catch(() => {
      if (active && !controller.signal.aborted) setDatasetContext(undefined);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [datasetId, runId]);

  useEffect(() => {
    if (!runId) {
      setReadiness({ status: "error", message: "게시할 Run ID가 없습니다." });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setReadiness({ status: "loading" });
    setConfirmation(undefined);
    publish.reset();
    getPublishReadiness(runId, "huggingface", controller.signal)
      .then((data) => {
        if (!active) return;
        if (data.run_id !== runId || data.target !== "huggingface") {
          setReadiness({ status: "error", message: "Builder readiness 응답이 선택한 Run과 일치하지 않습니다." });
          return;
        }
        setReadiness({ status: "loaded", data });
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setReadiness({ status: "error", message: describePublishFailure(cause).message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [runId, readinessVersion, publish.reset]);

  const destinationError = validatePublishDestination(destination);
  const builderReady = readiness.status === "loaded" && readiness.data.ready && readiness.data.blockers.length === 0;
  const canReview = Boolean(runId && builderReady && !destinationError && publish.status !== "publishing");

  const request = useMemo<PublishRequest>(() => ({
    target: "huggingface",
    destination,
    options: { private: isPrivate },
  }), [destination, isPrivate]);

  function updateDestination(value: string) {
    setDestination(value);
    setConfirmation(undefined);
    publish.reset();
  }

  function updatePrivate(value: boolean) {
    setIsPrivate(value);
    setConfirmation(undefined);
    publish.reset();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="게시"
        title={`${(datasetContext?.title ?? runId) || "Run"} 게시`}
        description="Builder가 선택한 Run의 준비 상태를 확인한 뒤 Hugging Face에 게시합니다."
      />

      <Card>
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">선택한 Run</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Dataset</dt><dd>{(datasetContext?.title ?? datasetId) || "확인되지 않음"}</dd></div>
          <div><dt className="text-muted-foreground">Run ID</dt><dd className="break-all font-mono">{runId || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Build 완료</dt><dd>{datasetContext?.finishedAt ? formatDateTime(datasetContext.finishedAt) : "확인되지 않음"}</dd></div>
          <div><dt className="text-muted-foreground">Target</dt><dd>Hugging Face</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">이 화면은 URL의 exact Run ID를 유지하며 latest Run으로 바꾸지 않습니다.</p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Builder readiness</h2><p className="mt-1 text-xs text-muted-foreground">Run·Gold·license·PII policy·서버 credential을 Builder가 판정합니다.</p></div>
          <Button variant="secondary" size="sm" disabled={readiness.status === "loading" || publish.status === "publishing"} onClick={() => setReadinessVersion((value) => value + 1)}>다시 확인</Button>
        </div>
        {readiness.status === "loading" ? <Skeleton className="mt-4 h-20 w-full" /> : null}
        {readiness.status === "error" ? <div className="mt-4" role="alert"><p className="text-sm text-red-700 dark:text-red-300">{readiness.message}</p></div> : null}
        {readiness.status === "loaded" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm font-medium">{builderReady ? "Builder 게시 준비 완료" : "Builder blocker가 있어 게시할 수 없습니다."}</p>
            {readiness.data.blockers.length > 0 ? <IssueList title="Blockers" issues={readiness.data.blockers} tone="error" /> : null}
            {readiness.data.warnings.length > 0 ? <IssueList title="Warnings" issues={readiness.data.warnings} tone="warning" /> : null}
            {readiness.data.blockers.some((issue) => issue.code === "credential_unavailable") ? <p className="text-xs text-muted-foreground">이 blocker는 source Provider credential이 아니라 Builder 서버의 Hugging Face publish credential을 뜻합니다. Studio는 token을 입력하거나 저장하지 않습니다.</p> : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">게시 설정</h2>
        <p className="mt-1 text-xs text-muted-foreground">Readiness와 별개인 로컬 입력 검증입니다. Builder readiness는 destination이나 공개 설정을 검증하지 않습니다.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="text-sm font-medium">Hugging Face destination
            <input aria-label="Hugging Face destination" className={`mt-2 ${inputClassName}`} placeholder="owner/dataset" value={destination} disabled={publish.status === "publishing"} onChange={(event) => updateDestination(event.target.value)} />
            <span className={`mt-1 block text-xs ${destinationError ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>{destinationError ?? "Builder가 허용하는 owner/dataset 식별자"}</span>
          </label>
          <label className="flex items-center gap-3 self-center rounded-lg border border-border p-4 text-sm">
            <input aria-label="비공개 Dataset" type="checkbox" checked={isPrivate} disabled={publish.status === "publishing"} onChange={(event) => updatePrivate(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
            <span><strong className="block">비공개 Dataset</strong><span className="text-xs text-muted-foreground">기본값: 비공개</span></span>
          </label>
        </div>
      </Card>

      {!confirmation ? (
        <Button className="self-start" disabled={!canReview} onClick={() => setConfirmation(request)}>최종 확인</Button>
      ) : (
        <Card className="border-emerald-300" aria-label="게시 최종 확인">
          <h2 className="text-sm font-semibold">게시 최종 확인</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Run ID</dt><dd className="font-mono">{runId}</dd></div>
            <div><dt className="text-muted-foreground">Target</dt><dd>huggingface</dd></div>
            <div><dt className="text-muted-foreground">Destination</dt><dd>{confirmation.destination}</dd></div>
            <div><dt className="text-muted-foreground">공개 설정</dt><dd>{confirmation.options?.private === false ? "Public" : "Private"}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">Builder의 POST 응답이 성공하기 전에는 게시 완료로 표시하지 않습니다.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button loading={publish.status === "publishing"} disabled={!builderReady || Boolean(validatePublishDestination(confirmation.destination))} onClick={() => void publish.start(runId, confirmation)}>게시 실행</Button>
            {publish.status !== "publishing" ? <Button variant="secondary" onClick={() => setConfirmation(undefined)}>설정 수정</Button> : <Button variant="secondary" onClick={publish.stopWaiting}>응답 기다리기 중단</Button>}
          </div>
        </Card>
      )}

      {publish.status === "published" && publish.result ? (
        <Card variant="success" role="status">
          <div className="flex items-center gap-2"><StatusBadge status="published" /><strong>Builder 게시 완료</strong></div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Run ID</dt><dd className="font-mono">{publish.result.run_id}</dd></div>
            <div><dt className="text-muted-foreground">Destination</dt><dd>{publish.result.destination}</dd></div>
            <div><dt className="text-muted-foreground">Publisher</dt><dd>{publish.result.publisher}</dd></div>
            <div><dt className="text-muted-foreground">Artifacts</dt><dd>{publish.result.artifact_count}</dd></div>
          </dl>
          <div className="mt-4 break-all text-sm">Reference: {isSafePublishReference(publish.result.reference) ? <a href={publish.result.reference} target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-300">{publish.result.reference}</a> : <span>{publish.result.reference}</span>}</div>
        </Card>
      ) : null}
      {publish.status === "failed" ? <Card variant="error" role="alert"><strong>게시 실패</strong><p className="mt-2 text-sm">{publish.failure?.message}</p>{publish.failure?.kind === "publish_state_unknown" ? <p className="mt-2 text-xs">자동 재시도하지 마세요.</p> : null}</Card> : null}
      {publish.status === "aborted" ? <Card role="status"><strong>응답 대기를 중단했습니다.</strong><p className="mt-2 text-sm text-muted-foreground">브라우저 요청만 중단했으며 원격 게시 작업을 취소한 것은 아닙니다. 게시 결과는 확인되지 않았습니다.</p></Card> : null}
    </main>
  );
}

function IssueList({ title, issues, tone }: { title: string; issues: PublishReadinessResponse["blockers"]; tone: "error" | "warning" }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3><ul className="mt-2 space-y-2">{issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={`rounded-lg px-3 py-2 text-sm ${tone === "error" ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}`}><span className="font-mono text-xs">{issue.code}</span><span className="ml-2">{issue.message}</span></li>)}</ul></div>;
}
