/**
 * ProviderPage — real Builder API 연동 + credential/status 계약 회귀 (#S01, #S02).
 *
 * - real mode는 GET /providers를 canonical source로 쓰고, 실패를 mock 성공으로
 *   위장하지 않는다(명시적 error + 빈 목록).
 * - 연결 테스트는 GET /providers/{provider}/status(임의 POST /test 아님).
 * - credential 저장/삭제는 singular `/credential` + { credential } body, 그리고
 *   선택된 provider의 canonical id를 URL에 쓴다.
 * - 명시적 mock mode는 기존 mock 목록 동작을 유지한다.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderPage } from "@/pages/ProviderPage";
import { builderApi } from "@/shared/lib/builderApi";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProviderPage />
    </MemoryRouter>,
  );
}

const STATUS_OK = {
  provider: "datago",
  status: "connected" as const,
  configured: true,
  latency_ms: 120,
  checked_at: "2026-08-31T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ProviderPage real mode (#S01)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
  });

  it("lists providers from GET /providers via the builder client", async () => {
    const spy = vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [
        { provider: "datago", requires_credential: true, configured: false },
        { provider: "kosis", requires_credential: false, configured: false },
      ],
    });

    renderPage();

    expect(await screen.findByText("datago")).toBeInTheDocument();
    expect(screen.getByText("kosis")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    // mock provider 이름이 새어 나오지 않는다.
    expect(screen.queryByText("데이터고")).not.toBeInTheDocument();
  });

  it("shows an explicit error and does NOT fall back to mock providers on API failure", async () => {
    vi.spyOn(builderApi, "listProviders").mockRejectedValue(new Error("network down"));

    renderPage();

    expect(await screen.findByText("Provider 정보를 불러올 수 없습니다")).toBeInTheDocument();
    expect(screen.queryByText("데이터고")).not.toBeInTheDocument();
    expect(screen.queryByText("KOSIS")).not.toBeInTheDocument();
    expect(screen.getByText("등록된 Provider가 없습니다")).toBeInTheDocument();
  });

  it("connection test calls GET /providers/{provider}/status (not POST /test)", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: true }],
    });
    const statusSpy = vi
      .spyOn(builderApi, "getProviderStatus")
      .mockResolvedValue(STATUS_OK);

    renderPage();
    fireEvent.click(await screen.findByText("datago"));
    fireEvent.click(screen.getByRole("button", { name: "연결 테스트" }));

    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith("datago"));
    expect((await screen.findAllByText("연결됨")).length).toBeGreaterThan(0);
  });

  it("credential save uses PUT /providers/{provider}/credential with { credential } and the selected provider id", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: false }],
    });
    const putSpy = vi
      .spyOn(builderApi, "putProviderCredential")
      .mockResolvedValue(undefined);

    renderPage();
    fireEvent.click(await screen.findByText("datago"));
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    fireEvent.change(screen.getByPlaceholderText("API Key를 입력하세요"), {
      target: { value: "secret-key-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith("datago", "secret-key-123"),
    );
  });

  it("credential delete uses DELETE /providers/{provider}/credential for the selected provider", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: true }],
    });
    const deleteSpy = vi
      .spyOn(builderApi, "deleteProviderCredential")
      .mockResolvedValue(undefined);

    renderPage();
    fireEvent.click(await screen.findByText("datago"));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("datago"));
  });
});

describe("ProviderPage mock mode (unchanged)", () => {
  it("keeps the deterministic mock provider list when real builder is disabled", async () => {
    const spy = vi.spyOn(builderApi, "listProviders");
    renderPage();

    expect(await screen.findByText("데이터고")).toBeInTheDocument();
    expect(screen.getByText("KOSIS")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
