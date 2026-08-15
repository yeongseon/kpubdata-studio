/**
 * Kubi evidence grounding (#256).
 *
 * 현재 `KubiContext`에 대해 Builder의 실제 API(`/catalog`, `/datasets/*`, `/builds/*`)만으로
 * safe evidence 번들을 구성한다. 원본 credential/service key가 evidence에 들어올 경우를
 * 대비해 `scrubSecrets`(#206, 기존 assistant 모듈 재사용)를 마지막 방어선으로 한 번 더 통과시킨다.
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
import { scrubSecrets } from "@/features/assistant/scrub";
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
 * @returns secret이 제거된 evidence 번들과, 응답 hallucination 검사를 위한 알려진 id 집합.
 */
export async function loadKubiEvidence(
  context: KubiContext,
  signal?: AbortSignal,
): Promise<{ evidence: KubiEvidence; knownRefs: KubiKnownRefs }> {
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
  };

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
      knownRefs.runIds.add(dataset.latest_run_id);
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
      for (const run of runsResult.value.runs) knownRefs.runIds.add(run.run_id);
    } else {
      unavailable.push("runs");
    }
  }

  if (runId) {
    knownRefs.runIds.add(runId);
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
      const quality = qualityResult.value;
      const results = Object.values(quality.quality_results).flat();
      const drift = Object.values(quality.schema_drift).flat();
      evidence.quality = {
        availability: quality.availability,
        evaluatedChecks: quality.evaluated_checks,
        results: results.map((result) => {
          const id = qualityResultRefId(result);
          knownRefs.qualityResultIds.add(id);
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
        const firstSource = stagesResult.value.sources[0];
        if (firstSource) {
          const detailResult = await settle(
            getBuildStageDetail(runId, context.stage, firstSource.source_key, 0, signal),
          );
          if (detailResult.ok) {
            const detail = detailResult.value;
            const rowCount = detail.stage === "bronze" ? detail.record_count : detail.row_count;
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
  const scrubbed = scrubSecrets(evidence).scrubbed as KubiEvidence;
  return { evidence: scrubbed, knownRefs };
}
