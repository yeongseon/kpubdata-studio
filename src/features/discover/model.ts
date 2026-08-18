/**
 * Discover(#249) 순수 모델 헬퍼.
 *
 * Builder `/catalog` 응답(provider별 dataset 목록)을 검색/필터링하기 위한 로직만 담는다.
 * 자연어 검색(Kubi, #256)이 아니라 dataset명/title/provider명에 대한 리터럴 substring
 * 매칭이다 — `DatasetCatalogPage`의 "정확 검색"과 같은 해석.
 */
import type { CatalogDataset, CatalogResponse } from "@/shared/lib/builderApi";

/** 카드 하나에 대응하는, provider와 dataset을 함께 들고 있는 flatten된 항목. */
export interface DiscoverEntry {
  provider: string;
  dataset: CatalogDataset;
}

/** provider별로 중첩된 catalog 응답을 카드 렌더링에 쓰기 좋은 평평한 목록으로 편다. */
export function flattenCatalog(catalog: CatalogResponse): DiscoverEntry[] {
  return catalog.providers.flatMap((provider) =>
    provider.datasets.map((dataset) => ({ provider: provider.name, dataset })),
  );
}

/** dataset명/title/provider명에 대한 대소문자 무시 substring 매칭. 빈 쿼리는 항상 통과. */
export function matchesQuery(entry: DiscoverEntry, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const haystack = `${entry.dataset.name} ${entry.dataset.title} ${entry.provider}`.toLocaleLowerCase();
  return haystack.includes(normalized);
}

/** provider 필터. 빈 문자열("전체")은 항상 통과. */
export function matchesProviderFilter(entry: DiscoverEntry, provider: string): boolean {
  return !provider || entry.provider === provider;
}

/** "서비스 키 필요만" 필터. false면 항상 통과(필터 미적용). */
export function matchesServiceKeyFilter(entry: DiscoverEntry, onlyRequiresKey: boolean): boolean {
  return !onlyRequiresKey || entry.dataset.requires_service_key;
}

/**
 * provider별 dataset 건수를 로드된 catalog에서 그때그때 계산한다 — 하드코딩된 provider
 * 목록/건수를 쓰지 않는다(#249 요구사항).
 */
export function computeProviderCounts(entries: DiscoverEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.provider, (counts.get(entry.provider) ?? 0) + 1);
  }
  return counts;
}

/** catalog 전체에서 알파벳순으로 정렬된 고유 provider 목록(필터 옵션용). */
export function uniqueProviders(entries: DiscoverEntry[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.provider))).sort();
}

/** requires_service_key=true인 항목 수 — "서비스 키 필요만" 체크박스 라벨에 표시. */
export function computeServiceKeyCount(entries: DiscoverEntry[]): number {
  return entries.filter((entry) => entry.dataset.requires_service_key).length;
}
