/**
 * Kubi evidence grounding (#256).
 *
 * 현재 `KubiContext`에 대해 Builder의 실제 API(`/catalog`, `/datasets/*`, `/builds/*`)만으로
 * safe evidence 번들을 구성한다. 원본 credential/service key가 evidence에 들어올 경우를
 * 대비해 `redactSecrets`(#206, 기존 assistant 모듈 재사용)를 마지막 방어선으로 통과시킨다.
 *
 * 일부 evidence 조회가 실패해도 전체를 실패시키지 않는다 — `partial`/`unavailable`로 어떤
 * 부분을 확인하지 못했는지 그대로 드러내고, Kubi가 "모든 걸 확인한 것처럼" 답하지 않게 한다.
 */
import {
  getBuildQuality,
  getBuildStageDetail,
  getDataset,
  listBuildStages,
  listDatasetRuns,
} from "@/features/datasets/api";
import { loadBuildSpec } from "@/features/build-spec/specStore";
import { redactSecrets } from "@/features/assistant/scrub";
import { builderApi } from "@/shared/lib/builderApi";
import type { KubiContext, KubiEvidence, KubiEvidenceSource, KubiKnownRefs } from "./types";
import { qualityResultRefId } from "./types";

async function settle<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await promise };
  } catch {
    return { ok: false };
  }
}

/**
 * 현재 context에 대한 evidence를 조회한다.
 *
 * @param context - evidence를 구성할 대상 문맥(요청 시작 시점 값으로 고정해서 넘겨야 한다).
 * @param signal - 취소 signal.
 * @returns secret이 제거된 evidence 번들, 응답 hallucination 검사를 위한 알려진 id 집합,
 *   그리고 LLM egress 엔트로피 오탐에서만 면제할 "Builder가 존재를 확인한" run id 집합.
 */
export async function loadKubiEvidence(
  context: KubiContext,
  signal?: AbortSignal,
): Promise<{ evidence: KubiEvidence; knownRefs: KubiKnownRefs; safeRunIds: Set<string> }> {
  const unavailable: KubiEvidenceSource[] = [];
  const evidence: KubiEvidence = {
    fetchedAt: new Date().toISOString(),
    context,
    deepLinks: {},
    partial: false,
    unavailable: [],
  };
  const knownRefs: KubiKnownRefs = {
    datasetIds: new Set(),
    runIds: new Set(),
    providers: new Set(),
    qualityResultIds: new Set(),
    schemaDriftIds: new Set(),
    sourceKeys: new Set(),
  };

  // knownRefs.runIds 와 safeRunIds 는 역할이 다르지만(전자는 crossCheck 의 hallucination
  // 대조, 후자는 LLM egress/redaction 엔트로피 오탐 면제) provenance 계약은 같다: 둘 다
  // "이번 evidence 로딩에서 Builder 응답으로 실제 존재가 확인된 run id" 만 담는다. route/
  // context.runId 는 evidence.context / deepLink / Builder 조회 target 으로만 쓰고, 존재가
  // 확인되기 전에는 어느 trust set 에도 넣지 않는다. 두 Set 이 다시 어긋나지 않도록 확인된
  // run 은 반드시 이 helper 를 통해 등록한다.
  const safeRunIds = new Set<string>();

  function confirmRunId(id: string | null | undefined): void {
    if (!id) return;
    knownRefs.runIds.add(id);
    safeRunIds.add(id);
  }

  const catalogResult = await settle(builderApi.catalog(signal));
  if (catalogResult.ok) {
    const datasetsByProvider: Record<string, string[]> = {};
    for (const provider of catalogResult.value.providers) {
      knownRefs.providers.add(provider.name);
      datasetsByProvider[provider.name] = provider.datasets.map((d) => d.name);
    }
    evidence.catalog = { providers: Object.keys(datasetsByProvider), datasetsByProvider };
  } else {
    unavailable.push("catalog");
  }

  let runId = context.runId;

  if (context.datasetId) {
    const [datasetResult, runsResult] = await Promise.all([
      settle(getDataset(context.datasetId, signal)),
      settle(listDatasetRuns(context.datasetId, 10, signal)),
    ]);

    if (datasetResult.ok) {
      const dataset = datasetResult.value;
      knownRefs.datasetIds.add(dataset.dataset_id);
      evidence.dataset = {
        datasetId: dataset.dataset_id,
        title: dataset.title,
        providers: dataset.sources.map((s) => s.provider),
        sources: dataset.sources.map((s) => ({ provider: s.provider, dataset: s.dataset })),
        latestRunId: dataset.latest_run_id,
        status: dataset.status,
        updatedAt: dataset.updated_at,
        totalRowCount: dataset.total_row_count,
      };
      // getDataset 성공 응답의 latest_run_id — Builder 가 확인한 값이다(schema 상 string 이나
      // 방어적으로 falsy 를 거른다).
      confirmRunId(dataset.latest_run_id);
      evidence.deepLinks.datasetDetail = `/datasets/${encodeURIComponent(dataset.dataset_id)}`;
      evidence.deepLinks.qualityCenter = `/quality?dataset=${encodeURIComponent(dataset.dataset_id)}`;
      runId = runId ?? dataset.latest_run_id;
    } else {
      unavailable.push("dataset");
    }

    if (runsResult.ok) {
      evidence.recentRuns = runsResult.value.runs.map((run) => ({
        runId: run.run_id,
        status: run.status,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
      }));
      // listDatasetRuns 성공 응답의 run_id — Builder 가 직접 반환한 실제 run 이다.
      for (const run of runsResult.value.runs) confirmRunId(run.run_id);
    } else {
      unavailable.push("runs");
    }
  }

  if (runId) {
    // runId 가 route/context 에서 왔다면(dataset.latest_run_id 로 이미 confirm 된 경우가 아니면)
    // 아직 존재가 확인되지 않았다. deepLink 계산과 Builder 조회 target 으로는 쓰되, knownRefs/
    // safeRunIds 에는 넣지 않는다 — 아래 getBuildQuality / listBuildStages 는 nonexistent run 에
    // 404 를 주므로(Builder OpenAPI SSOT), 그 요청이 정상 응답할 때만 confirmRunId 로 등록한다.
    evidence.deepLinks.buildDetail = `/builds/${encodeURIComponent(runId)}`;

    const storedSpec = loadBuildSpec(runId);
    if (storedSpec) {
      evidence.buildSpecSummary = {
        title: storedSpec.title,
        description: storedSpec.description,
        sources: storedSpec.sources.map((source) => ({
          provider: source.provider,
          dataset: source.dataset,
          alias: source.alias,
          paramKeys: Object.keys(source.params),
        })),
        exportFormats: storedSpec.exports.map((e) => e.format),
        metadataKeys: Object.keys(storedSpec.metadata),
      };
    }

    const qualityResult = await settle(getBuildQuality(runId, signal));
    if (qualityResult.ok) {
      // GET /builds/{run_id}/quality 는 nonexistent run 에 404 를 준다 — 200 이면 실제 run 이다.
      confirmRunId(runId);
      const quality = qualityResult.value;
      const results = Object.values(quality.quality_results).flat();
      const drift = Object.values(quality.schema_drift).flat();
      evidence.quality = {
        availability: quality.availability,
        evaluatedChecks: quality.evaluated_checks,
        results: results.map((result) => {
          const id = qualityResultRefId(result);
          knownRefs.qualityResultIds.add(id);
          knownRefs.sourceKeys.add(result.source_key);
          return {
            id,
            sourceKey: result.source_key,
            category: result.category,
            rule: result.rule,
            column: result.column,
            status: result.status,
            actual: result.actual,
            threshold: result.threshold,
            detail: result.detail,
          };
        }),
        schemaDrift: drift.map((finding) => {
          knownRefs.schemaDriftIds.add(`${finding.kind}::${finding.column ?? "_"}`);
          return { kind: finding.kind, column: finding.column, detail: finding.detail };
        }),
      };
    } else {
      unavailable.push("quality");
    }

    // stage evidence는 source/stage 둘 다 문맥에 있을 때만 의미가 있다. source가 없으면
    // stage 목록에서 첫 source를 추론하지 않는다 — 존재하지 않는 근거를 만들지 않기 위함이다.
    if (context.stage) {
      const stagesResult = await settle(listBuildStages(runId, signal));
      if (stagesResult.ok) {
        // GET /builds/{run_id}/stages 도 nonexistent run 에 404 를 준다 — 200 이면 실제 run 이다.
        confirmRunId(runId);
        // stage 목록의 모든 source_key는 이 run의 실제 canonical source다 — Generated SQL의
        // source 검증에 쓸 수 있게 전부 모은다(quality evidence가 없어도 검증 가능).
        for (const source of stagesResult.value.sources) knownRefs.sourceKeys.add(source.source_key);
        const firstSource = stagesResult.value.sources[0];
        if (firstSource) {
          const detailResult = await settle(
            getBuildStageDetail(runId, context.stage, firstSource.source_key, 0, signal),
          );
          if (detailResult.ok) {
            const detail = detailResult.value;
            const rowCount = detail.stage === "bronze" ? detail.record_count : detail.row_count;
            knownRefs.sourceKeys.add(firstSource.source_key);
            evidence.stage = {
              stage: context.stage,
              sourceKey: firstSource.source_key,
              status: detail.status,
              available: detail.available,
              rowCount,
            };
          } else {
            unavailable.push("stage");
          }
        }
      } else {
        unavailable.push("stage");
      }
    }
  }

  evidence.unavailable = unavailable;
  evidence.partial = unavailable.length > 0;

  // 방어적 마지막 관문: Builder 응답에 예상치 못한 credential성 필드가 섞여 있어도 여기서 걸러낸다.
  // 엔트로피 오탐 면제는 safeRunIds(= Builder 가 존재를 확인한 exact run id) 로만 한다. 아직
  // 확인되지 않은 route context.runId(예: `?run=` / `/builds/:id`)는 여기에도 knownRefs.runIds
  // 에도 들어 있지 않으므로 evidence 에서 그대로 새어 나가지 않는다.
  const redacted = redactSecrets(evidence, safeRunIds) as KubiEvidence;
  return { evidence: redacted, knownRefs, safeRunIds };
}
