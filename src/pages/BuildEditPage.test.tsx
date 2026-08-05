/**
 * BuildEditPage 유닛 테스트.
 *
 * 기존 빌드 스펙 로드, 편집, 검증, 저장 흐름을 검증한다.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BuildEditPage } from "./BuildEditPage";
import type { BuildSpec } from "@/shared/lib/types";

// React Router hooks를 모킹
const mockNavigate = vi.fn();
const mockUseParams = vi.fn(() => ({ buildId: "test-build-1" }));

vi.mock("react-router-dom", async () => {
  const actual = await import("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: mockUseParams,
  };
});

// validateSpec API를 모킹
vi.mock("@/features/validation/api", () => ({
  validateSpec: vi.fn(async (spec: BuildSpec) => ({ valid: true, errors: [] })),
}));

const mockBuildSpec: BuildSpec = {
  datasetId: "test-dataset",
  title: "테스트 빌드",
  description: "테스트용 빌드입니다",
  sources: [{ provider: "datago", dataset: "air-quality", params: { region: "seoul" } }],
  exports: [{ format: "jsonl" }],
  metadata: { outputPath: "artifacts/builds/test" },
};

describe("BuildEditPage", () => {
  beforeAll(() => {
    // test 환경에서 import.meta.env.VITE_USE_REAL_BUILDER가 undefined이므로 mock 설정
    (globalThis as unknown as { import: { meta: { env: { VITE_USE_REAL_BUILDER: string } } } }).import = {
      meta: {
        env: {
          VITE_USE_REAL_BUILDER: "false",
        },
      },
    };
  });

  it("빌드 편집 페이지가 렌더링된다", async () => {
    render(<BuildEditPage />);

    await waitFor(() => {
      expect(screen.getByText(/빌드 편집/)).toBeInTheDocument();
    });
  });

  it("초기 스펙이 폼에 로드된다", async () => {
    render(<BuildEditPage />);

    await waitFor(() => {
      expect(screen.getByText(/테스트 빌드/)).toBeInTheDocument();
    });
  });

  it("검증 버튼을 누르면 Builder POST /validate를 호출한다", async () => {
    const { validateSpec } = await import("@/features/validation/api");

    render(<BuildEditPage />);

    await waitFor(() => {
      expect(screen.getByText(/다시 검증/)).toBeInTheDocument();
    });

    // TODO: 버튼 클릭 테스트 구현
  });

  it("취소 버튼을 누르면 빌드 상세 페이지로 이동한다", async () => {
    render(<BuildEditPage />);

    await waitFor(() => {
      expect(screen.getByText(/취소/)).toBeInTheDocument();
    });

    // TODO: 버튼 클릭 테스트 구현
    // 현재 테스트에서 navigate를 확인하지 않음 - 실제 클릭 이벤트 필요
  });
});