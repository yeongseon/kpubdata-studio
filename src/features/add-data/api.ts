/**
 * Add Data Workbench(#250)가 쓰는 Builder API 얇은 래퍼.
 *
 * 새 엔드포인트를 재구현하지 않고 `shared/lib/builderApi.ts`의 client를 그대로
 * 감싼다. 여기서 하는 일은 (1) mock/real 분기, (2) 응답을 화면이 바로 쓰기 좋은
 * 형태로 살짝 다듬는 것뿐이다.
 */
import { builderApi, isRealBuilderEnabled, type CatalogResponse, type ProviderTestResponse, type UploadMetadata } from "@/shared/lib/builderApi";
import type { SourceFormat } from "@/shared/lib/types";

const MOCK_CATALOG: CatalogResponse = {
  providers: [
    {
      name: "datago",
      datasets: [
        {
          name: "apt_trade",
          title: "아파트 실거래가",
          description: "국토교통부 아파트 매매 실거래가 조회",
          tags: ["real-estate"],
          source_url: null,
          representation: "api_json",
          operations: ["list"],
          query_support: null,
          requires_service_key: true,
          request_parameters: [],
        },
        {
          name: "air_quality",
          title: "대기오염 측정망",
          description: "환경부 대기오염 측정망 시간자료",
          tags: ["environment"],
          source_url: null,
          representation: "api_json",
          operations: ["list"],
          query_support: null,
          requires_service_key: true,
          request_parameters: [
            { name: "sidoName", required: true, description: "조회할 시·도", example: "서울" },
          ],
          application: {
            required: true,
            url: "https://www.data.go.kr/data/15073861/openapi.do",
          },
        },
      ],
    },
  ],
};

/** GET /catalog — provider/dataset 카탈로그 (mock 모드에서는 결정적 목업). */
export async function fetchCatalog(signal?: AbortSignal): Promise<CatalogResponse> {
  if (!isRealBuilderEnabled()) return MOCK_CATALOG;
  return builderApi.catalog(signal);
}

/**
 * POST /providers/{provider}/test 래퍼(#492). generic Provider probe는 임의의 첫
 * Dataset을 필수 파라미터 없이 호출하므로 "연결 성공 여부"로 신뢰할 수 없어 Add
 * Data user flow에서 제거됐다(#S-provider-probe). Builder contract는 유지되므로
 * 래퍼 자체는 남겨 둔다(직접 진단용). mock 모드에서는 항상 connected를 반환한다.
 */
export async function testProvider(provider: string, signal?: AbortSignal): Promise<ProviderTestResponse> {
  if (!isRealBuilderEnabled()) {
    return { provider, status: "connected", configured: true, latency_ms: 42, checked_at: new Date().toISOString() };
  }
  return builderApi.testProviderConnection(provider, signal);
}

/**
 * GET /providers 요약에서 provider별 "effective credential 구성 여부"만 추린다
 * (#S-add-data). Add Data의 credential prerequisite가 이 값을 authoritative
 * source로 재사용한다 — `configured`는 user credential > server default > 없음을
 * 반영한 effective 값이며(ADR 0012), Studio가 별도로 credential 존재를 추측하지
 * 않는다. mock 모드는 `testProvider`(위)와 마찬가지로 항상 connected/configured로
 * 취급해 네트워크 없이 나머지 mock 흐름을 막지 않는다 — prerequisite UX 자체는
 * `ConfigureStep`에 `providerConfigured` prop을 직접 주입하는 컴포넌트 테스트로
 * 검증한다.
 */
export async function fetchProviderConfigured(signal?: AbortSignal): Promise<Record<string, boolean>> {
  if (!isRealBuilderEnabled()) return { datago: true };
  const response = await builderApi.listProviders(signal);
  return Object.fromEntries(response.providers.map((p) => [p.provider, p.configured]));
}

/**
 * kind="file" source용 업로드(#498). mock 모드에서는 실제 파일 content를 읽지 않고
 * 결정적 upload_id를 만들어 즉시 반환한다(브라우저가 파일 content를 별도 정본으로
 * 보관하지 않는다는 원칙은 그대로 유지 — 여기서도 content를 읽지 않는다).
 */
export async function uploadSourceFile(
  file: File,
  format: SourceFormat,
  signal?: AbortSignal,
): Promise<UploadMetadata> {
  if (!isRealBuilderEnabled()) {
    return {
      upload_id: "upl_00000000000000000000000000000000",
      format,
      encoding: "utf-8",
      size_bytes: file.size,
      original_filename: file.name,
      created_at: new Date().toISOString(),
    };
  }
  const bytes = await file.arrayBuffer();
  return builderApi.uploadFile(bytes, { format, filename: file.name }, signal);
}
