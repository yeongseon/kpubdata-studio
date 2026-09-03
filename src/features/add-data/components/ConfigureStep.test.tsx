/**
 * Configure 단계 — credential prerequisite / readiness(#S-add-data,
 * #S-provider-probe)와 Dataset 필수 요청 파라미터 UX 회귀 테스트.
 *
 * generic Provider probe("Provider 연결 확인" 버튼)는 신뢰할 수 없어 제거됐다 —
 * Add Data는 authoritative prerequisite(requires credential AND configured=false)만
 * 쓰고, 실제 사용 가능 여부는 Preview가 확인한다.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfigureStep, type CatalogState } from "./ConfigureStep";
import { INITIAL_DRAFT, type AddDataDraft } from "@/features/add-data/model";
import type { CatalogProvider } from "@/shared/lib/builderApi";

const PROVIDERS: CatalogProvider[] = [
  {
    name: "datago",
    datasets: [
      {
        name: "air_quality",
        title: "대기오염",
        description: "측정망 시간자료",
        tags: [],
        source_url: null,
        representation: "api_json",
        operations: ["list"],
        query_support: null,
        requires_service_key: true,
        request_parameters: [
          { name: "sidoName", required: true, description: "조회할 시·도", example: "서울" },
          { name: "numOfRows", required: false, description: null, example: null },
        ],
        application: { required: true, url: "https://www.data.go.kr/data/15073861/openapi.do" },
      },
      {
        name: "free_form",
        title: "자유입력",
        description: null,
        tags: [],
        source_url: null,
        representation: "api_json",
        operations: ["list"],
        query_support: null,
        requires_service_key: true,
        request_parameters: [],
      },
    ],
  },
];

function renderStep(overrides: {
  draft?: Partial<AddDataDraft>;
  providerConfigured?: Record<string, boolean> | null;
  updateDraft?: (patch: Partial<AddDataDraft>) => void;
  onConnectProvider?: (provider: string) => void;
}) {
  const draft: AddDataDraft = {
    ...INITIAL_DRAFT,
    sourceKind: "public_api",
    publicApi: { provider: "datago", dataset: "air_quality", sourceParams: "{}" },
    ...overrides.draft,
  };
  const catalog: CatalogState = { status: "loaded", providers: PROVIDERS };
  render(
    <ConfigureStep
      draft={draft}
      updateDraft={overrides.updateDraft ?? vi.fn()}
      catalog={catalog}
      upload={{ status: "idle" }}
      onUploadFile={vi.fn()}
      providerConfigured={overrides.providerConfigured ?? null}
      onConnectProvider={overrides.onConnectProvider ?? vi.fn()}
      yamlText=""
      onApplyYaml={vi.fn()}
    />,
  );
}

describe("ConfigureStep — generic Provider probe 제거", () => {
  it("'Provider 연결 확인' 같은 generic live probe 버튼을 더 이상 보여주지 않는다", () => {
    renderStep({ providerConfigured: { datago: true } });
    expect(screen.queryByRole("button", { name: "Provider 연결 확인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /연결 테스트/ })).not.toBeInTheDocument();
  });

  it("provider가 configured면 인증 정보 준비 상태와 Preview 안내만 보여준다", () => {
    renderStep({ providerConfigured: { datago: true } });
    expect(screen.getByText("인증 정보 준비됨")).toBeInTheDocument();
    expect(screen.getByText(/실제 데이터 인출 가능 여부는\s*다음 단계 Preview에서 확인/)).toBeInTheDocument();
  });

  it("configured 여부를 아직 모르면(null) 준비됨도 막힘도 보여주지 않는다", () => {
    renderStep({ providerConfigured: null });
    expect(screen.queryByText("인증 정보 준비됨")).not.toBeInTheDocument();
    expect(screen.queryByText("API 연결이 필요합니다")).not.toBeInTheDocument();
  });
});

describe("ConfigureStep — 필수 요청 파라미터 UX", () => {
  it("선택 Dataset metadata의 필수 파라미터를 예시와 함께 보여준다", () => {
    renderStep({});
    expect(screen.getByText("이 Dataset의 요청 파라미터")).toBeInTheDocument();
    expect(screen.getByText("sidoName")).toBeInTheDocument();
    expect(screen.getByText("조회할 시·도", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/예: 서울/).length).toBeGreaterThan(0);
    // 구체 예시가 generic 예시를 대체한다.
    expect(screen.getByText('예: {"sidoName":"서울"}')).toBeInTheDocument();
  });

  it("metadata가 없는 Dataset은 중립 예시만 보여주고 필수 안내는 없다", () => {
    renderStep({
      draft: { publicApi: { provider: "datago", dataset: "free_form", sourceParams: "{}" } },
    });
    expect(screen.queryByText("이 Dataset의 요청 파라미터")).not.toBeInTheDocument();
    expect(screen.getByText('예: {"region": "seoul"}')).toBeInTheDocument();
  });

  it("예시값 적용 버튼을 누르면 example 값을 채우고, 이미 입력된 값은 덮어쓰지 않는다", () => {
    const updateDraft = vi.fn();
    renderStep({
      draft: { publicApi: { provider: "datago", dataset: "air_quality", sourceParams: '{"numOfRows":"10"}' } },
      updateDraft,
    });

    fireEvent.click(screen.getByRole("button", { name: "예시값 적용" }));

    expect(updateDraft).toHaveBeenCalledTimes(1);
    const patch = updateDraft.mock.calls[0][0] as { publicApi: { sourceParams: string } };
    const merged = JSON.parse(patch.publicApi.sourceParams) as Record<string, string>;
    expect(merged.sidoName).toBe("서울");
    expect(merged.numOfRows).toBe("10"); // 기존 입력값을 덮어쓰지 않는다.
  });

  it("example이 없는 Dataset은 예시값 적용 버튼을 보여주지 않는다", () => {
    renderStep({
      draft: { publicApi: { provider: "datago", dataset: "free_form", sourceParams: "{}" } },
    });
    expect(screen.queryByRole("button", { name: "예시값 적용" })).not.toBeInTheDocument();
  });
});

describe("ConfigureStep — API 연결 credential prerequisite", () => {
  it("credential이 필요한 Dataset인데 provider가 미설정이면 진행을 막고 안내한다", () => {
    const onConnectProvider = vi.fn();
    renderStep({ providerConfigured: { datago: false }, onConnectProvider });

    expect(screen.getByText("API 연결이 필요합니다")).toBeInTheDocument();
    expect(screen.getByText(/API Key가 필요한 Provider를 사용합니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "API 연결하기" }));
    expect(onConnectProvider).toHaveBeenCalledWith("datago");
  });

  it("provider가 이미 configured면 막지 않는다", () => {
    renderStep({ providerConfigured: { datago: true } });
    expect(screen.queryByText("API 연결이 필요합니다")).not.toBeInTheDocument();
  });

  it("configured 여부를 아직 알 수 없으면(null) 추측해서 막지 않는다", () => {
    renderStep({ providerConfigured: null });
    expect(screen.queryByText("API 연결이 필요합니다")).not.toBeInTheDocument();
  });
});

describe("ConfigureStep — Dataset 활용신청 안내", () => {
  it("application.required면 활용신청 안내와 공식 페이지 링크를 보여준다", () => {
    renderStep({});
    expect(screen.getByText("데이터 활용신청을 확인해주세요")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /공식 페이지에서 확인/ });
    expect(link).toHaveAttribute("href", "https://www.data.go.kr/data/15073861/openapi.do");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("application metadata가 없는 Dataset은 활용신청 안내를 보여주지 않는다", () => {
    renderStep({
      draft: { publicApi: { provider: "datago", dataset: "free_form", sourceParams: "{}" } },
    });
    expect(screen.queryByText("데이터 활용신청을 확인해주세요")).not.toBeInTheDocument();
  });
});
