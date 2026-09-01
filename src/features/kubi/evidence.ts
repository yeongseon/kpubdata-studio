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
import { getBuildSpecSnapshot } from "@/features/runs/api/runDetail";
import { redactSecrets } from "@/features/assistant/scrub";
import { builderApi } from "@/shared/lib/builderApi";
import { parse as parseYaml } from "yaml";
import type { KubiContext, KubiEvidence, KubiEvidenceSource, KubiKnownRefs } from "./types";
import { datasetRunMembershipRef, qualityResultRefId, stageEvidenceRefId } from "./types";

async function settle<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await promise };
  } catch {
    return { ok: false };
  }
}

/** Builder canonical spec snapshot에서 명시적인 dataset_id만 읽는다. */
function datasetIdFromSpecSnapshot(spec: string): string | null {
  try {
    const parsed = parseYaml(spec) as unknown;
    if (!parsed || typeof parsed !== "object" || !("dataset_id" in parsed)) return null;
    const datasetId = (parsed as Record<string, unknown>).dataset_id;
    return typeof datasetId === "string" && datasetId.length > 0 ? datasetId : null;
  } catch {
    return null;
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
): Promise<{
  evidence: KubiEvidence;
  knownRefs: KubiKnownRefs;
  safeRunIds: Set<string>;
  safeEvidenceIds: Set<string>;
}> {
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
    datasetRunMemberships: new Set(),
    providers: new Set(),
    qualityResultIds: new Set(),
    schemaDriftIds: new Set(),
    stageIds: new Set(),
    sourceKeys: new Set(),
  };

  // knownRefs.runIds 와 safeRunIds 는 역할이 다르지만(전자는 crossCheck 의 hallucination
  // 대조, 후자는 LLM egress/redaction 엔트로피 오탐 면제) provenance 계약은 같다: 둘 다
  // "이번 evidence 로딩에서 Builder 응답으로 실제 존재가 확인된 run id" 만 담는다. route/
  // context.runId 는 evidence.context / deepLink / Builder 조회 target 으로만 쓰고, 존재가
  // 확인되기 전에는 어느 trust set 에도 넣지 않는다. 두 Set 이 다시 어긋나지 않도록 확인된
  // run 은 반드시 이 helper 를 통해 등록한다.
  const safeRunIds = new Set<string>();

  // safeRunIds 와 provenance 계약은 같지만(엔트로피 오탐에서만 면제하는 exact 값) 대상이
  // 다르다: 여기에는 Builder `/quality` 응답 필드로부터 Studio 가 deterministic 하게 만든
  // evidence identifier(qualityResultRefId / schema drift key)만 담는다. `datago.air_quality::
  // completeness::min_rows::_` 같은 canonical id 는 Shannon 엔트로피가 4.0 을 넘어(길이·문자
  // 다양성), safeRunIds 만 넘기면 redactSecrets 가 valid quality id 를 `[REDACTED]` 로
  // 오탐한다. 형태(`quality:` prefix 등)가 아니라 "이번 로딩에서 실제로 생성한 exact 문자열"
  // 로만 면제한다. 사용자 질문/모델 출력에서 온 값은 절대 넣지 않는다.
  const safeEvidenceIds = new Set<string>();

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
      if (dataset.latest_run_id) {
        knownRefs.datasetRunMemberships.add(datasetRunMembershipRef(dataset.dataset_id, dataset.latest_run_id));
      }
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
      for (const run of runsResult.value.runs) {
        confirmRunId(run.run_id);
        if (datasetResult.ok && datasetResult.value.dataset_id === context.datasetId) {
          knownRefs.datasetRunMemberships.add(datasetRunMembershipRef(datasetResult.value.dataset_id, run.run_id));
        }
      }
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

    // 오래된 run이 recent run-list 범위 밖이어도 Builder canonical spec snapshot은 해당
    // run이 실행된 dataset_id를 직접 제공한다. 다른 membership 근거와 독립적으로 조회하고,
    // 실패/파싱 불가는 이 근거만 제외한다.
    const specSnapshotPromise = settle(getBuildSpecSnapshot(runId, signal));

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
          safeEvidenceIds.add(id);
          knownRefs.sourceKeys.add(result.source_key);
          return {
            id,
            source: result.source_key,
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
          const driftId = `${finding.kind}::${finding.column ?? "_"}`;
          knownRefs.schemaDriftIds.add(driftId);
          safeEvidenceIds.add(driftId);
          return { kind: finding.kind, column: finding.column, detail: finding.detail };
        }),
      };
    } else {
      unavailable.push("quality");
    }

    const specSnapshotResult = await specSnapshotPromise;
    if (specSnapshotResult.ok && specSnapshotResult.value.run_id === runId) {
      const snapshotDatasetId = datasetIdFromSpecSnapshot(specSnapshotResult.value.spec);
      if (snapshotDatasetId) {
        confirmRunId(runId);
        knownRefs.datasetRunMemberships.add(datasetRunMembershipRef(snapshotDatasetId, runId));
      }
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
        const sources = stagesResult.value.sources;
        for (const source of sources) knownRefs.sourceKeys.add(source.source_key);
        // 어느 소스의 stage를 볼지: (1) 화면에서 선택된 context.source가 이 run의 실제
        // source면 그것을, (2) 선택이 없고 이 run의 source가 정확히 1개면 그 유일 소스를,
        // (3) 그 외(복수 source인데 선택 없음/선택이 이 run에 없음)면 임의 선택하지 않고
        // fail-closed로 stage를 unavailable 처리한다(P5 canonical source policy와 동일).
        const chosenSource = context.source
          ? sources.find((source) => source.source_key === context.source)
          : sources.length === 1
            ? sources[0]
            : undefined;
        if (chosenSource) {
          // stage evidence 는 status/available/row_count 메타데이터만 쓰고 sample row 는
          // 읽지 않는다. 하지만 Builder `/builds/{run}/stages/{stage}` 는 limit=0 을
          // "positive integer up to 1000" 위반으로 400 을 준다(OpenAPI SSOT) — 실
          // Builder 에서 stage evidence 가 항상 unavailable 로 빠지던 원인. 최소 sample(1)
          // 로 요청해 메타데이터만 취한다.
          const detailResult = await settle(
            getBuildStageDetail(runId, context.stage, chosenSource.source_key, 1, signal),
          );
          if (detailResult.ok) {
            const detail = detailResult.value;
            const refId = stageEvidenceRefId(runId, chosenSource.source_key, detail.stage);
            const rowCount = detail.stage === "bronze" ? detail.record_count : detail.row_count;
            knownRefs.sourceKeys.add(chosenSource.source_key);
            knownRefs.stageIds.add(refId);
            safeEvidenceIds.add(refId);
            // Generated SQL이 컬럼명/타입을 추측하지 않도록, Builder가 이미 반환한 stage
            // schema만 canonical하게 노출한다. silver는 {name,dtype}까지, gold는 이름만
            // (contract상 dtype이 없다), bronze는 없다. sample row는 여전히 읽지 않는다.
            let columns: string[] | undefined;
            let schema: { name: string; dtype: string }[] | undefined;
            if (detail.stage === "silver" && detail.schema.length > 0) {
              schema = detail.schema.map((column) => ({ name: column.name, dtype: column.dtype }));
              columns = schema.map((column) => column.name);
            } else if (detail.stage === "gold" && detail.columns.length > 0) {
              columns = [...detail.columns];
            }
            evidence.stage = {
              refId,
              stage: context.stage,
              source: chosenSource.source_key,
              status: detail.status,
              available: detail.available,
              rowCount,
              ...(columns ? { columns } : {}),
              ...(schema ? { schema } : {}),
            };
          } else {
            unavailable.push("stage");
          }
        } else {
          unavailable.push("stage");
        }
      } else {
        unavailable.push("stage");
      }
    }
  }

  evidence.unavailable = unavailable;
  evidence.partial = unavailable.length > 0;

  // 방어적 마지막 관문: Builder 응답에 예상치 못한 credential성 필드가 섞여 있어도 여기서 걸러낸다.
  // 엔트로피 오탐 면제는 provenance 가 확인된 exact 값 — safeRunIds(Builder 가 존재를 확인한
  // run id) + safeEvidenceIds(Builder `/quality` 응답에서 deterministic 하게 만든 evidence
  // identifier) — 로만 한다. 아직 확인되지 않은 route context.runId 나 임의 문자열은 어느
  // 집합에도 없으므로 evidence 에서 그대로 새어 나가지 않는다. secret-named field masking 은
  // 이 면제보다 항상 먼저 적용된다(scrub.ts).
  const safeValues = new Set<string>([...safeRunIds, ...safeEvidenceIds]);
  const redacted = redactSecrets(evidence, safeValues) as KubiEvidence;
  return { evidence: redacted, knownRefs, safeRunIds, safeEvidenceIds };
}
