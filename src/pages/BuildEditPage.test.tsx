/**
 * BuildEditPage 유닛 테스트.
 *
 * 기존 빌드 스펙 로드, 편집, 검증, 저장 흐름을 검증한다.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BuildEditPage } from "../BuildEditPage";
import type { BuildSpec } from "@/shared/lib/types";

// React Router hooks를 모킹
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useParams: vi.fn(() => ({ buildId: "test-build-1" })),
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
    global.import = {
      meta: {
        env: {
          VITE_USE_REAL_BUILDER: "false",
        },
      },
    } as unknown as ImportMeta;
  });

  it("빌드 편집 페이지가 렌더링된다", async () => {
    render(
      <MemoryRouter initialEntries={["/builds/test-build-1/edit"]}>
        <Routes>
          <Route path="/builds/:buildId/edit" element={<BuildEditPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/빌드 편집/)).toBeInTheDocument();
    });
  });

  it("초기 스펙이 폼에 로드된다", async () => {
    render(
      <MemoryRouter initialEntries={["/builds/test-build-1/edit"]}>
        <Routes>
          <Route path="/builds/:buildId/edit" element={<BuildEditPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/테스트 빌드/)).toBeInTheDocument();
    });
  });

  it("검증 버튼을 누르면 Builder POST /validate를 호출한다", async () => {
    const user = userEvent.setup();
    const { validateSpec } = await import("@/features/validation/api");

    render(
      <MemoryRouter initialEntries={["/builds/test-build-1/edit"]}>
        <Routes>
          <Route path="/builds/:buildId/edit" element={<BuildEditPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/다시 검증/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/다시 검증/));

    await waitFor(() => {
      expect(validateSpec).toHaveBeenCalled();
    });
  });

  it("취소 버튼을 누르면 빌드 상세 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();

    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useParams).mockReturnValue({ buildId: "test-build-1" });

    render(
      <MemoryRouter initialEntries={["/builds/test-build-1/edit"]}>
        <Routes>
          <Route path="/builds/:buildId/edit" element={<BuildEditPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/취소/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/취소/));

    expect(navigate).toHaveBeenCalledWith("/builds/test-build-1");
  });
});