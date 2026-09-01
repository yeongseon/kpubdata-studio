/**
 * 구조화 응답을 evidence/catalog와 대조해 환각을 걸러낸다 (#256).
 *
 * 4중 게이트의 2단계. zod는 "모양"만 확인했으므로, 여기서는 응답이 인용한 모든 id
 * (dataset/run/provider/quality 결과/schema drift)가 실제로 이번 evidence에 존재하는지
 * 하나씩 대조한다. 존재하지 않는 참조는 답변 전체를 버리지 않고 해당 항목만 제거해,
 * 답변이 실제로 나은(evidence 기반) 부분은 그대로 사용자에게 보여준다.
 */
import type { KubiEvidence, KubiEvidenceRef, KubiKnownRefs, KubiStructuredResponse } from "./types";
import type { KubiAction } from "./schema";

export interface CrossCheckResult {
  response: KubiStructuredResponse;
  /** 제거된 evidenceRef 설명(사용자에게 "이 근거는 확인되지 않아 제외했습니다"로 보여줄 수 있음). */
  rejectedRefs: string[];
  /** 제거된 suggestedAction 설명. */
  rejectedActions: string[];
  /** generatedSql이 제거된 경우 사유. */
  rejectedSqlReason?: string;
}

function isKnownEvidenceRef(ref: KubiEvidenceRef, known: KubiKnownRefs, evidence: KubiEvidence): boolean {
  switch (ref.kind) {
    case "dataset":
      return known.datasetIds.has(ref.id);
    case "run":
      return known.runIds.has(ref.id);
    case "catalog":
      return known.providers.has(ref.id);
    case "quality":
      return known.qualityResultIds.has(ref.id);
    case "schema_drift":
      return known.schemaDriftIds.has(ref.id);
    case "stage":
      return known.stageIds.has(ref.id) && evidence.stage?.refId === ref.id;
    default:
      return false;
  }
}

function isKnownAction(
  action: KubiAction,
  known: KubiKnownRefs,
  evidence: KubiEvidence,
): { ok: true } | { ok: false; reason: string } {
  switch (action.type) {
    case "OPEN_PROVIDER":
      return known.providers.has(action.provider)
        ? { ok: true }
        : { ok: false, reason: `OPEN_PROVIDER: catalog에 없는 provider "${action.provider}"` };
    case "OPEN_BUILD":
      return known.runIds.has(action.runId)
        ? { ok: true }
        : { ok: false, reason: `OPEN_BUILD: evidence에 없는 run "${action.runId}"` };
    case "OPEN_QUALITY":
      if (!known.datasetIds.has(action.datasetId)) {
        return { ok: false, reason: `OPEN_QUALITY: evidence에 없는 dataset "${action.datasetId}"` };
      }
      if (action.runId && !known.runIds.has(action.runId)) {
        return { ok: false, reason: `OPEN_QUALITY: evidence에 없는 run "${action.runId}"` };
      }
      return { ok: true };
    case "PATCH_BUILDSPEC":
      if (!known.runIds.has(action.runId)) {
        return { ok: false, reason: `PATCH_BUILDSPEC: evidence에 없는 run "${action.runId}"` };
      }
      if (!evidence.buildSpecSummary) {
        return {
          ok: false,
          reason: `PATCH_BUILDSPEC: run "${action.runId}"의 원본 BuildSpec을 이 브라우저에서 찾을 수 없어 안전하게 diff를 만들 수 없습니다`,
        };
      }
      return { ok: true };
    case "CREATE_BUILD_DRAFT": {
      if (!known.providers.has(action.values.provider)) {
        return { ok: false, reason: `CREATE_BUILD_DRAFT: catalog에 없는 provider "${action.values.provider}"` };
      }
      const knownDatasets = evidence.catalog?.datasetsByProvider[action.values.provider] ?? [];
      if (!knownDatasets.includes(action.values.sourceDataset)) {
        return {
          ok: false,
          reason: `CREATE_BUILD_DRAFT: "${action.values.provider}" catalog에 없는 dataset "${action.values.sourceDataset}"`,
        };
      }
      return { ok: true };
    }
    case "ADD_REPORT_BLOCK":
      // 자유 형식 노트라 대조할 리소스 id가 없다 — zod 통과만으로 충분하다.
      return { ok: true };
  }
}

/**
 * 구조화 응답을 evidence/catalog와 대조해 hallucinated 항목을 제거한다.
 *
 * @param response - zod 검증을 통과한 구조화 응답.
 * @param evidence - 이번 요청에 사용한 evidence 번들.
 * @param knownRefs - evidence에서 추출한 "실제로 존재하는" id 집합.
 * @returns 검증을 통과한 항목만 남은 응답과, 제거된 항목 목록.
 */
export function crossCheckKubiResponse(
  response: KubiStructuredResponse,
  evidence: KubiEvidence,
  knownRefs: KubiKnownRefs,
): CrossCheckResult {
  const rejectedRefs: string[] = [];
  const evidenceRefs = response.evidenceRefs.filter((ref) => {
    const known = isKnownEvidenceRef(ref, knownRefs, evidence);
    if (!known) rejectedRefs.push(`${ref.kind}:${ref.id} (${ref.label})`);
    return known;
  });

  const rejectedActions: string[] = [];
  const suggestedActions = response.suggestedActions.filter((action) => {
    const check = isKnownAction(action, knownRefs, evidence);
    if (!check.ok) rejectedActions.push(check.reason);
    return check.ok;
  });

  let generatedSql = response.generatedSql;
  let rejectedSqlReason: string | undefined;
  if (generatedSql) {
    if (evidence.context.stage !== generatedSql.stage) {
      rejectedSqlReason = `현재 화면 stage(${evidence.context.stage ?? "없음"})와 제안된 SQL의 stage(${generatedSql.stage})가 일치하지 않아 실행 대상에서 제외했습니다.`;
      generatedSql = null;
    } else if (generatedSql.source && !knownRefs.sourceKeys.has(generatedSql.source)) {
      // 모델이 만든 source 문자열이 evidence의 canonical source_key와 정확히 일치하지 않는다.
      // "__"→"." 같은 추측성 정규화는 하지 않는다 — canonical evidence와 대조만 한다.
      // (evidence.stage가 없어도 quality 결과·stage 목록에서 모은 knownRefs.sourceKeys로 검증한다.)
      const singleSource = knownRefs.sourceKeys.size === 1 || evidence.dataset?.sources.length === 1;
      if (singleSource) {
        // 단일 소스 run이고 다른 ambiguity가 없으므로, 미검증 source는 버리고 Builder가
        // 유일 source를 자동 선택하게 한다(SQL 본문 자체는 살린다).
        rejectedSqlReason = `제안된 source "${generatedSql.source}"를 evidence에서 확인할 수 없어 제거했습니다. 단일 소스 run이라 Builder가 자동으로 소스를 선택합니다.`;
        generatedSql = { ...generatedSql, source: undefined };
      } else {
        // multi-source에서 미검증 source는 어떤 소스를 조회할지 결정할 수 없다 — fail-closed.
        rejectedSqlReason = `evidence에 없는 source "${generatedSql.source}"를 참조해 실행 대상에서 제외했습니다.`;
        generatedSql = null;
      }
    }
  }

  return {
    response: { answer: response.answer, evidenceRefs, generatedSql, suggestedActions },
    rejectedRefs,
    rejectedActions,
    rejectedSqlReason,
  };
}
