/**
 * ProviderPage — real Builder API 연동 + credential 진실성 회귀 (#S01, #S02, F01).
 *
 * - real mode는 GET /providers를 canonical source로 쓰고, 실패를 mock 성공으로
 *   위장하지 않는다(명시적 error + 빈 목록).
 * - 연결 테스트는 GET /providers/{provider}/status(임의 POST /test 아님).
 * - "사용자 저장 credential" 유무/마스킹은 GET /providers/{provider}/credential
 *   메타데이터로만 판정한다 — GET /providers 요약의 `configured`(effective provider
 *   configuration)와 분리한다.
 * - requires_credential=false → 가짜 masked key / Delete 없음.
 * - server-default-only(요약 configured=true, 사용자 credential 없음) → Delete 없음, 등록 허용.
 * - 사용자 credential 존재 → Builder masked 값 표시 + Delete.
 * - raw secret은 DOM에 노출되지 않는다.
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
    vi.spyOn(builderApi, "getProviderCredential").mockResolvedValue({
      provider: "datago",
      configured: false,
      masked: null,
      updated_at: null,
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

  it("requires_credential=false → no masked key, no Delete, no register form", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "opendata", requires_credential: false, configured: true }],
    });
    const credSpy = vi.spyOn(builderApi, "getProviderCredential");

    renderPage();
    fireEvent.click(await screen.findByText("opendata"));

    expect(
      await screen.findByText(/자격 증명 없이 사용할 수 있습니다\. 등록하거나 삭제할/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "등록하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "사용자 자격 증명 등록" })).not.toBeInTheDocument();
    expect(screen.queryByText(/마스킹/)).not.toBeInTheDocument();
    // credential 메타데이터 조회 자체를 하지 않는다.
    expect(credSpy).not.toHaveBeenCalled();
  });

  it("server-default-only provider (summary configured=true, no user credential) → no Delete, register allowed", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: true }],
    });
    vi.spyOn(builderApi, "getProviderCredential").mockResolvedValue({
      provider: "datago",
      configured: false,
      masked: null,
      updated_at: null,
    });

    renderPage();
    fireEvent.click(await screen.findByText("datago"));

    expect(
      await screen.findByText(/Builder 기본 자격 증명으로 사용 중/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사용자 자격 증명 등록" })).toBeInTheDocument();
  });

  it("user credential present → shows Builder masked value + Delete, never the raw secret", async () => {
    vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: true }],
    });
    vi.spyOn(builderApi, "getProviderCredential").mockResolvedValue({
      provider: "datago",
      configured: true,
      masked: "AK••••9f",
      updated_at: "2026-08-30T10:00:00.000Z",
    });

    renderPage();
    fireEvent.click(await screen.findByText("datago"));

    expect(await screen.findByText("AK••••9f")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "등록하기" })).not.toBeInTheDocument();
    // 원문/full key 후보가 DOM에 없다.
    expect(document.body.textContent).not.toContain("••••••••••••••••");
  });

  it("credential save uses PUT /credential then re-fetches summary + credential metadata", async () => {
    const listSpy = vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: false }],
    });
    const credSpy = vi.spyOn(builderApi, "getProviderCredential").mockResolvedValue({
      provider: "datago",
      configured: false,
      masked: null,
      updated_at: null,
    });
    const putSpy = vi
      .spyOn(builderApi, "putProviderCredential")
      .mockResolvedValue(undefined);

    renderPage();
    fireEvent.click(await screen.findByText("datago"));
    fireEvent.click(await screen.findByRole("button", { name: "등록하기" }));
    fireEvent.change(screen.getByPlaceholderText("API Key를 입력하세요"), {
      target: { value: "secret-key-123" },
    });

    // 저장 후 사용자 credential이 생겼다고 응답하도록 바꾼다.
    credSpy.mockResolvedValue({
      provider: "datago",
      configured: true,
      masked: "se••••23",
      updated_at: "2026-08-31T00:00:00.000Z",
    });
    listSpy.mockClear();
    credSpy.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(putSpy).toHaveBeenCalledWith("datago", "secret-key-123"));
    // save 후 두 소스를 다시 authoritative하게 갱신한다.
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(credSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("se••••23")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("credential delete uses DELETE /credential then re-fetches state", async () => {
    const listSpy = vi.spyOn(builderApi, "listProviders").mockResolvedValue({
      providers: [{ provider: "datago", requires_credential: true, configured: true }],
    });
    const credSpy = vi.spyOn(builderApi, "getProviderCredential").mockResolvedValue({
      provider: "datago",
      configured: true,
      masked: "AK••••9f",
      updated_at: "2026-08-30T10:00:00.000Z",
    });
    const deleteSpy = vi
      .spyOn(builderApi, "deleteProviderCredential")
      .mockResolvedValue(undefined);

    renderPage();
    fireEvent.click(await screen.findByText("datago"));
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

    credSpy.mockResolvedValue({
      provider: "datago",
      configured: false,
      masked: null,
      updated_at: null,
    });

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("datago"));
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
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
