/**
 * Discover(#249) API 계층.
 *
 * Builder `GET /catalog`(원천 provider/dataset 카탈로그)를 조회한다 — 이미 빌드된
 * 데이터셋 목록(`GET /datasets`, `features/datasets/api`)과는 다른 소스이니 섞지 않는다.
 *
 * mock/real 분기는 `features/datasets/api`가 이미 확립한 패턴을 그대로 따른다:
 * `builderApi.catalog()` 자체는 mock 분기가 없으므로(#246 원칙 — mock/demo와 real Builder
 * 동작을 명확히 구분), 이 계층에서 `isRealBuilderEnabled()`로 나눈다.
 */
import { builderApi, isRealBuilderEnabled, type CatalogResponse } from "@/shared/lib/builderApi";

/**
 * mock 모드에서 쓰는 결정적 fixture.
 *
 * requires_service_key가 true/false 둘 다 있어야 배지/필터를 시연할 수 있고, provider가
 * 2개 이상이어야 provider 필터가 의미를 갖는다. Builder #490 rich metadata(description/
 * tags/source_url 등)가 catalog 스키마에 포함됨에 따라(#250) fixture도 스키마 전체를
 * 채운다 — P0 화면은 표시하지 않아도 계약과 드리프트되지 않는다.
 */
function dataset(
  name: string,
  title: string,
  requiresServiceKey: boolean,
  description = null,
): CatalogResponse["providers"][number]["datasets"][number] {
  return {
    name,
    title,
    description,
    tags: [],
    source_url: null,
    representation: "api_json",
    operations: ["list"],
    query_support: null,
    requires_service_key: requiresServiceKey,
  };
}

const MOCK_CATALOG: CatalogResponse = {
  providers: [
    {
      name: "datago",
      datasets: [
        dataset("air_quality", "대기오염 정보", true),
        dataset("apt_trade", "아파트 실거래가", true),
        dataset("dur_product_info", "DUR 품목정보", false),
      ],
    },
    {
      name: "kosis",
      datasets: [
        dataset("population_stat", "인구총조사", false),
      ],
    },
    {
      name: "seoul",
      datasets: [
        dataset("bike_rental", "따릉이 대여 현황", true),
      ],
    },
  ],
};

/** GET /catalog — provider/dataset 원천 카탈로그를 조회한다(#249). */
export async function loadCatalog(signal?: AbortSignal): Promise<CatalogResponse> {
  if (isRealBuilderEnabled()) return builderApi.catalog(signal);
  return MOCK_CATALOG;
}
