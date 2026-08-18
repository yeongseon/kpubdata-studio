import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as datasetsApi from "@/features/datasets/api";
import * as runsApi from "@/features/runs/api";
import { BuildsPage } from "@/pages/BuildsPage";
import { ApiError } from "@/shared/lib/builderApi";

function renderBuilds(initialPath = "/builds") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BuildsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Builds run history (#12, #255 master-detail)", () => {
  it("renders rows with status badges and lets the user select a run", async () => {
    renderBuilds();
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
    expect(screen.getAllByText("성공").length).toBeGreaterThan(0); // succeeded badges
    // "실패"는 상태 필터 <option>에도 나타나므로 배지(span)로만 좁혀서 확인한다.
    expect(screen.getAllByText("실패", { selector: "span" }).length).toBeGreaterThan(0);

    // 목록 항목을 선택하면 오른쪽 상세 패널에 같은 run이 열린다.
    fireEvent.click(screen.getByText("대기오염 정보"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "대기오염 정보" })).toBeInTheDocument();
    });
  });

  it("filters the history by title/id search", async () => {
    renderBuilds();
    await screen.findByText("대기오염 정보");

    fireEvent.change(screen.getByLabelText("Run 검색"), { target: { value: "병용" } });

    await waitFor(() => {
      expect(screen.queryByText("대기오염 정보")).not.toBeInTheDocument();
    });
    expect(screen.getByText("병용금기 품목정보")).toBeInTheDocument();
  });

  it("shows an error state with retry when listing fails (#71)", async () => {
    const realBuilds = await runsApi.listBuilds();
    const spy = vi
      .spyOn(runsApi, "listBuilds")
      .mockRejectedValueOnce(new Error("네트워크 오류"));
    renderBuilds();

    expect(await screen.findByText("빌드 목록을 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 오류");

    // 재시도하면 실제 목록을 다시 불러온다.
    spy.mockResolvedValueOnce(realBuilds);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
  });
});

describe("selected Run permission state (#255 P0)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selected Run 403: 존재 판정 근거인 stage 조회가 403이면 '찾을 수 없습니다'가 아니라 권한 없음으로 구분한다", async () => {
    vi.spyOn(datasetsApi, "listBuildStages").mockRejectedValue(
      new ApiError(403, "권한이 없습니다"),
    );

    renderBuilds("/builds?run=not-in-scope-run");

    expect(await screen.findByText(/이 Run을 조회할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/Run을 찾을 수 없습니다/)).not.toBeInTheDocument();

    // 전체 Runs 목록은 계속 정상 렌더된다 — supplementary/detail 403이 목록을 죽이지 않는다.
    expect(await screen.findByText("대기오염 정보")).toBeInTheDocument();
  });

  it("selected Run 404: 존재 판정 근거인 stage 조회가 404면 기존 not-found 메시지를 유지한다", async () => {
    vi.spyOn(datasetsApi, "listBuildStages").mockRejectedValue(
      new ApiError(404, "찾을 수 없습니다"),
    );

    renderBuilds("/builds?run=not-in-scope-run");

    expect(await screen.findByText(/Run을 찾을 수 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/이 Run을 조회할 권한이 없습니다/)).not.toBeInTheDocument();
  });

  it("Quality/Stage supplementary 403에서도 목록에 있는 run의 core 정보(제목/상태)는 유지된다", async () => {
    vi.spyOn(datasetsApi, "getBuildQuality").mockRejectedValue(new ApiError(403, "권한이 없습니다"));
    vi.spyOn(datasetsApi, "listBuildStages").mockRejectedValue(new ApiError(403, "권한이 없습니다"));

    renderBuilds("/builds?run=air-quality-20260621");

    // core 정보(제목)는 계속 보인다 — supplementary 403이 상세 전체를 죽이지 않는다.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "대기오염 정보" })).toBeInTheDocument();
    });
    expect(screen.getByText(/이 Run의 Quality 결과를 조회할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/이 Run의 Stage Progress를 조회할 권한이 없습니다/)).toBeInTheDocument();
  });
});
