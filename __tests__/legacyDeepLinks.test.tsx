import { act, render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/app/router";
import { useUIStore } from "@/shared/hooks/useUIStore";

/**
 * App Shell 재구성(#247) 이후에도 실제 `router.tsx` 설정을 통해 레거시 딥링크와 새 IA 라우트가
 * 모두 정상적으로 화면을 렌더하는지 확인한다. 개별 페이지를 직접 렌더하는 다른 테스트와 달리,
 * 여기서는 브라우저 라우터 전체(basename 포함)를 통해 실제 route 매칭을 검증한다.
 */
async function navigateTo(path: string) {
  await act(async () => {
    await router.navigate(path);
  });
}

describe("router 딥링크 회귀 (#247)", () => {
  beforeEach(() => {
    // jsdom에는 matchMedia가 없으므로 system 테마 분기를 피하도록 light로 고정한다.
    act(() => useUIStore.setState({ theme: "light", isSidebarOpen: false }));
  });

  it("legacy /validate, /preview, /artifacts 단독 라우트는 계속 동작한다", async () => {
    render(<RouterProvider router={router} />);

    await navigateTo("/validate");
    expect(screen.getByRole("heading", { name: "검증 결과" })).toBeInTheDocument();

    await navigateTo("/preview");
    expect(screen.getByRole("heading", { name: "데이터 미리보기" })).toBeInTheDocument();

    await navigateTo("/artifacts");
    expect(screen.getByRole("heading", { name: "생성된 결과물" })).toBeInTheDocument();
  });

  it("기존 build 단위 딥링크(:buildId/*)는 그대로 유지된다", async () => {
    render(<RouterProvider router={router} />);

    await navigateTo("/builds/abc/run");
    expect(screen.getByText("진행 단계")).toBeInTheDocument();

    await navigateTo("/builds/abc/artifacts");
    expect(await screen.findByText("Manifest 요약")).toBeInTheDocument();

    await navigateTo("/builds/abc/publish");
    expect(screen.getByText("HuggingFace Dataset")).toBeInTheDocument();
  });

  it("새 IA route(#247)도 셸 안에서 정상적으로 렌더된다", async () => {
    render(<RouterProvider router={router} />);

    await navigateTo("/discover");
    expect(screen.getByRole("heading", { name: "데이터 탐색" })).toBeInTheDocument();

    await navigateTo("/quality");
    expect(screen.getByRole("heading", { name: "품질 센터" })).toBeInTheDocument();

    await navigateTo("/datasets/air-quality");
    expect(await screen.findByRole("heading", { name: "대기질 통합 데이터" })).toBeInTheDocument();
  });

  it("존재하지 않는 화면은 관련 없는 기존 화면을 재사용하지 않고 오류 폴백으로 처리한다", async () => {
    render(<RouterProvider router={router} />);

    await navigateTo("/no-such-route-xyz");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
