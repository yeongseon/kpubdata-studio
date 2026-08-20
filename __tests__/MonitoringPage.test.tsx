/**
 * Monitoring 화면 테스트 (#264).
 *
 * - system/builds/recent-runs tabs 렌더링
 * - loading/error/empty states 처리
 * - 자동/수동 새로고침 기능
 * - 데이터 연동 테스트
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MonitoringPage } from "@/pages/MonitoringPage";
import { builderApi, isRealBuilderEnabled } from "@/shared/lib/builderApi";

vi.mock("@/shared/lib/builderApi", () => ({
  isRealBuilderEnabled: vi.fn(() => false),
  builderApi: {
    getMonitoring: vi.fn(),
  },
}));

describe("MonitoringPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRealBuilderEnabled).mockReturnValue(false);
  });

  it("기본 제목과 설명을 렌더링한다", async () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /시스템 모니터링/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/실행 이력과 시스템 리소스 상태를 실시간으로 확인합니다/),
      ).toBeInTheDocument();
    });
  });

  it("system/builds/recent-runs 탭을 렌더링한다", async () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "System Resources" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Build Statistics" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Recent Runs" })).toBeInTheDocument();
    });
  });

  it("탭 전환이 정상적으로 작동한다", async () => {
    const { user } = setupUserEvent();

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "System Resources" })).toHaveClass(
        expect.stringContaining("border-b-2")
      );
    });

    await user.click(screen.getByRole("button", { name: "Build Statistics" }));

    expect(screen.getByRole("button", { name: "Build Statistics" })).toHaveClass(
      expect.stringContaining("border-b-2")
    );
    expect(screen.getByRole("button", { name: "System Resources" })).not.toHaveClass(
      expect.stringContaining("border-b-2")
    );
  });

  it("loading 상태를 올바르게 표시한다", async () => {
    vi.mocked(builderApi.getMonitoring).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("데이터 로드 중...")).toHaveLength(1);
    expect(screen.getAllByRole("progressbar")).toHaveLength(5);
  });

  it("데이터 로드 후 system 리소스를 올바르게 표시한다", async () => {
    const mockResponse = {
      system: {
        health: {
          status: "healthy",
          p95_latency: 245,
        },
        queue: {
          queued: 3,
          running: 2,
          total: 5,
        },
        workers: {
          active: 2,
          capacity: 4,
          utilization: 0.5,
        },
        artifact_store: {
          status: "ok",
          last_write: new Date().toISOString(),
        },
      },
      builds: {
        stats: [
          { time: "00:00", success: 12, failed: 1, cancelled: 0 },
          { time: "04:00", success: 8, failed: 0, cancelled: 1 },
        ],
        total_success: 20,
        total_failed: 1,
        total_cancelled: 1,
        recent_runs: [],
      },
    };

    vi.mocked(builderApi.getMonitoring).mockResolvedValue(mockResponse);

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Builder API")).toBeInTheDocument();
      expect(screen.getByText("Queue")).toBeInTheDocument();
      expect(screen.getByText("Workers")).toBeInTheDocument();
      expect(screen.getByText("Artifact Store")).toBeInTheDocument();
    });
  });

  it("자동 새로고침 토글 기능이 작동한다", async () => {
    const { user } = setupUserEvent();

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /자동 새로고침 ON/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /자동 새로고침 ON/ }));

    expect(screen.getByRole("button", { name: /자동 새로고침 OFF/ })).toBeInTheDocument();
  });

  it("수동 새로고침 버튼이 작동한다", async () => {
    const mockResponse = {
      system: {
        health: {
          status: "healthy",
          p95_latency: 200,
        },
        queue: null,
        workers: null,
        artifact_store: {
          status: "ok",
          last_write: new Date().toISOString(),
        },
      },
      builds: {
        stats: [],
        total_success: 0,
        total_failed: 0,
        total_cancelled: 0,
        recent_runs: [],
      },
    };

    vi.mocked(builderApi.getMonitoring).mockResolvedValue(mockResponse);

    const { user } = setupUserEvent();

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: "새로고침" });

    await user.click(refreshButton);

    expect(vi.mocked(builderApi.getMonitoring)).toHaveBeenCalled();
  });

  it("API 에러 시 error state를 올바르게 표시한다", async () => {
    vi.mocked(builderApi.getMonitoring).mockRejectedValue(new Error("API Error"));

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/데이터를 가져올 수 없습니다/)).toBeInTheDocument();
    });
  });

  it("빈 데이터일 때 empty state를 올바르게 표시한다", async () => {
    const mockResponse = {
      system: {
        health: {
          status: "healthy",
          p95_latency: 100,
        },
        queue: null,
        workers: null,
        artifact_store: {
          status: "ok",
          last_write: null,
        },
      },
      builds: {
        stats: [],
        total_success: 0,
        total_failed: 0,
        total_cancelled: 0,
        recent_runs: [],
      },
    };

    vi.mocked(builderApi.getMonitoring).mockResolvedValue(mockResponse);

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/빌드 기록이 없습니다/)).toBeInTheDocument();
    });
  });

  it("recent runs 탭에서 데이터를 올바르게 표시한다", async () => {
    const mockResponse = {
      system: {
        health: {
          status: "healthy",
          p95_latency: 150,
        },
        queue: null,
        workers: null,
        artifact_store: {
          status: "ok",
          last_write: new Date().toISOString(),
        },
      },
      builds: {
        stats: [],
        total_success: 2,
        total_failed: 1,
        total_cancelled: 0,
        recent_runs: [
          {
            id: "run-001",
            title: "테스트 빌드",
            status: "succeeded",
            started_at: new Date(Date.now() - 3600000).toISOString(),
            finished_at: new Date(Date.now() - 1800000).toISOString(),
            duration: 1800,
          },
        ],
      },
    };

    vi.mocked(builderApi.getMonitoring).mockResolvedValue(mockResponse);

    const { user } = setupUserEvent();

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Recent Runs" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Recent Runs" }));

    expect(screen.getByText("테스트 빌드")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument();
    expect(screen.getByText(/1800초/)).toBeInTheDocument();
  });

  it("실연동 모드에서는 builderApi를 호출한다", async () => {
    vi.mocked(isRealBuilderEnabled).mockReturnValue(true);

    const mockResponse = {
      system: {
        health: {
          status: "healthy",
          p95_latency: 120,
        },
        queue: null,
        workers: null,
        artifact_store: {
          status: "ok",
          last_write: null,
        },
      },
      builds: {
        stats: [],
        total_success: 0,
        total_failed: 0,
        total_cancelled: 0,
        recent_runs: [],
      },
    };

    vi.mocked(builderApi.getMonitoring).mockResolvedValue(mockResponse);

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(builderApi.getMonitoring)).toHaveBeenCalled();
    });
  });

  it("mock 모드에서는 mock 데이터를 사용한다", async () => {
    vi.mocked(isRealBuilderEnabled).mockReturnValue(false);

    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(builderApi.getMonitoring)).not.toHaveBeenCalled();
      expect(screen.getByText("Builder API")).toBeInTheDocument();
    });
  });
});