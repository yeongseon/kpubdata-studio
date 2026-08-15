/**
 * 관련 데이터셋 후보 (#256 이슈 체크리스트 — "관련 데이터셋 후보는 실제 `/catalog` evidence와 대조").
 *
 * 프로토타입의 "관련 데이터셋" 패널은 하드코딩된 예시(한국은행 기준금리 × ECOS 등)였다. 여기서는
 * LLM이 아니라 순수 함수로 `evidence.catalog`(Builder 실제 `/catalog` 응답)만 근거로 후보를
 * 계산한다 — LLM을 거치지 않으므로 hallucination cross-check가 필요 없고, 존재하지 않는
 * provider/dataset을 추천할 수 없다.
 *
 * 현재 dataset과 같은 provider의 catalog dataset만 "관련"으로 본다. 다른 provider까지 추측해서
 * 엮지 않는다 — evidence 원칙(#256 리뷰 §11, context.ts와 동일)을 그대로 따른다.
 */
import type { KubiEvidence } from "./types";

export interface KubiRelatedDataset {
  provider: string;
  /** Builder catalog의 source dataset명(예: "air_quality"). Studio dataset_id가 아니다 — 딥링크를 만들지 않는다. */
  dataset: string;
}

/**
 * 현재 evidence에서 "같은 provider의 다른 catalog dataset" 후보를 계산한다.
 *
 * @param evidence - 이번 turn의 evidence 번들(catalog/dataset이 모두 조회되어야 후보가 나온다).
 * @param limit - 반환할 최대 후보 수.
 * @returns 현재 dataset 자신을 제외한, catalog에 실제로 존재하는 후보 목록(최대 `limit`개).
 */
export function relatedCatalogDatasets(evidence: KubiEvidence, limit = 5): KubiRelatedDataset[] {
  if (!evidence.catalog || !evidence.dataset) return [];

  const ownKeys = new Set(evidence.dataset.sources.map((s) => `${s.provider}::${s.dataset}`));
  const seen = new Set<string>();
  const candidates: KubiRelatedDataset[] = [];

  for (const provider of evidence.dataset.providers) {
    const datasetNames = evidence.catalog.datasetsByProvider[provider] ?? [];
    for (const name of datasetNames) {
      const key = `${provider}::${name}`;
      if (ownKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ provider, dataset: name });
      if (candidates.length >= limit) return candidates;
    }
  }

  return candidates;
}
