import { describe, expect, it } from "vitest";
import { datasetIdFromParts, findDataset, findProvider, identityFromCatalog, identityFromFilename, identityFromUrl, slugify } from "./identity";
import type { CatalogDataset, CatalogProvider } from "@/shared/lib/builderApi";

function dataset(overrides: Partial<CatalogDataset> = {}): CatalogDataset {
  return {
    name: "apt_trade",
    title: "아파트 실거래가",
    description: "국토교통부 아파트 매매 실거래가 조회",
    tags: [],
    source_url: null,
    representation: "api_json",
    operations: ["list"],
    query_support: null,
    requires_service_key: false,
    ...overrides,
  };
}

describe("slugify/datasetIdFromParts", () => {
  it("허용되지 않는 문자를 -로 치환하고 앞뒤 -를 제거한다", () => {
    expect(slugify("Air Quality (2026)!!")).toBe("air-quality-2026");
  });

  it("빈 입력이면 fallback을 반환한다", () => {
    expect(slugify("   ")).toBe("dataset");
  });

  it("여러 조각을 이어붙여 slug화한다", () => {
    expect(datasetIdFromParts("datago", "apt_trade")).toBe("datago-apt-trade");
  });
});

describe("identityFromCatalog (Public API, #250 amendment 2)", () => {
  it("provider+dataset name 기반 deterministic dataset_id와 catalog title/description을 그대로 쓴다", () => {
    const identity = identityFromCatalog("datago", dataset());
    expect(identity.datasetId).toBe("datago-apt-trade");
    expect(identity.title).toBe("아파트 실거래가");
    expect(identity.description).toBe("국토교통부 아파트 매매 실거래가 조회");
  });

  it("catalog description이 null이면 provider/dataset 출처만 서술하는 factual 기본값을 쓴다(내용을 지어내지 않음)", () => {
    const identity = identityFromCatalog("datago", dataset({ description: null }));
    expect(identity.description).toBe("datago/apt_trade 데이터셋입니다.");
  });
});

describe("identityFromFilename (File, #250 amendment 2)", () => {
  it("확장자를 제거하고 정규화한 slug를 dataset_id로 쓴다", () => {
    expect(identityFromFilename("2026 Apt Trades.csv").datasetId).toBe("2026-apt-trades");
  });

  it("title은 사람이 읽기 쉬운 형태로 만든다", () => {
    expect(identityFromFilename("apt_trade_seoul.jsonl").title).toBe("Apt Trade Seoul");
  });
});

describe("identityFromUrl (URL, #250 amendment 2)", () => {
  it("hostname+path만으로 dataset_id/title을 만든다", () => {
    const identity = identityFromUrl("https://api.example.org/v1/air-quality");
    expect(identity.datasetId).toBe("api-example-org-v1-air-quality");
  });

  it("query string은 identity에 포함하지 않는다", () => {
    const withQuery = identityFromUrl("https://api.example.org/v1/air-quality?token=SECRET&region=seoul");
    const withoutQuery = identityFromUrl("https://api.example.org/v1/air-quality");
    expect(withQuery.datasetId).toBe(withoutQuery.datasetId);
    expect(withQuery.datasetId).not.toMatch(/secret|token/i);
  });

  it("credential(user:pass@host)은 identity에 포함하지 않는다", () => {
    const identity = identityFromUrl("https://user:s3cr3t@api.example.org/data");
    expect(identity.datasetId).not.toMatch(/user|s3cr3t/i);
  });

  it("잘못된 URL이면 빈 identity를 반환한다", () => {
    expect(identityFromUrl("not-a-url")).toEqual({ datasetId: "", title: "", description: "" });
  });

  it("description도 query string/credential 없는 base만 사용한다", () => {
    const identity = identityFromUrl("https://user:s3cr3t@api.example.org/data?token=SECRET");
    expect(identity.description).not.toMatch(/secret|token|s3cr3t/i);
  });

  // #250 최종 검증 §2: "URL 객체가 credential/query를 담지 않는다"는 설명은 틀렸다 —
  // `new URL(...)`은 username/password/search/hash를 그대로 보존한다
  // (`url.username`/`url.password`/`url.search`/`url.hash`로 읽을 수 있다). 실제
  // 안전성은 identity 생성 시 `url.hostname`/`url.pathname`만 allowlist 방식으로
  // 골라 쓰기 때문이지, URL 객체 자체가 그 값들을 안 담기 때문이 아니다. 아래는 그
  // allowlist 동작을 credential+query+fragment가 모두 섞인 URL로 직접 검증한다.
  it("username/password/query/fragment가 모두 있어도 URL 객체 자체는 이를 보존하지만, dataset identity에는 새지 않는다", () => {
    const endpoint = "https://user:secret@example.com/api/data?token=abc#section";
    const url = new URL(endpoint);
    // 전제 확인: URL 객체는 실제로 credential/query/fragment를 담는다.
    expect(url.username).toBe("user");
    expect(url.password).toBe("secret");
    expect(url.search).toBe("?token=abc");
    expect(url.hash).toBe("#section");

    // 안전성은 identityFromUrl이 hostname+pathname만 골라 쓰는 데서 온다.
    const identity = identityFromUrl(endpoint);
    const serialized = `${identity.datasetId} ${identity.title} ${identity.description}`;
    expect(serialized).not.toMatch(/user|secret|token|abc|section/i);
    expect(identity.datasetId).toBe("example-com-api-data");
  });
});

describe("findProvider/findDataset", () => {
  const providers: CatalogProvider[] = [{ name: "datago", datasets: [dataset()] }];

  it("이름으로 provider/dataset을 찾는다", () => {
    expect(findProvider(providers, "datago")?.name).toBe("datago");
    expect(findDataset(providers, "datago", "apt_trade")?.title).toBe("아파트 실거래가");
  });

  it("없는 이름이면 undefined를 반환한다", () => {
    expect(findDataset(providers, "datago", "missing")).toBeUndefined();
  });
});
