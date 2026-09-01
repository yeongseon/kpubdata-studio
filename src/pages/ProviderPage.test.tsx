/**
 * ProviderPage credential 상태·race 테스트.
 *
 * 검증 대상:
 * - credential configured / not-configured 상태를 각각 정확히 렌더
 * - GET /providers/{p}/credential 503(운영자가 master key 미구성)을 "저장소 미구성"으로
 *   구분해서 표시 — "아직 등록 안 함"이나 일반 오류와 섞지 않는다
 * - provider A 조회가 pending인 동안 B로 전환하면 A의 늦은 응답이 B 패널을 오염하지 않는다
 * - A의 credential mutation(저장) 완료 뒤의 늦은 metadata refresh도 B를 덮지 않는다
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { mswServer } from "../../vitest.setup";
import { API_BASE } from "@/shared/config/env";
import { ProviderPage } from "./ProviderPage";

const PROVIDERS = {
  providers: [
    { provider: "datago", requires_credential: true, configured: false },
    { provider: "kosis", requires_credential: true, configured: false },
  ],
};

function renderProviders() {
  return render(
    <MemoryRouter>
      <ProviderPage />
    </MemoryRouter>,
  );
}

async function selectProvider(name: string) {
  fireEvent.click(await screen.findByText(name));
}

beforeEach(() => {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
  mswServer.use(http.get(`${API_BASE}/providers`, () => HttpResponse.json(PROVIDERS)));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ProviderPage credential 상태", () => {
  it("configured=true면 마스킹 값과 삭제 버튼을 보여준다", async () => {
    mswServer.use(
      http.get(`${API_BASE}/providers/datago/credential`, () =>
        HttpResponse.json({ configured: true, masked: "dg••••99", updated_at: "2026-08-15T09:25:00+00:00" }),
      ),
    );
    renderProviders();
    await selectProvider("datago");

    expect(await screen.findByText(/dg••••99/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("configured=false면 등록 CTA를 보여주고 마스킹 값/삭제 버튼은 없다", async () => {
    mswServer.use(
      http.get(`${API_BASE}/providers/datago/credential`, () =>
        HttpResponse.json({ configured: false, masked: null, updated_at: null }),
      ),
    );
    renderProviders();
    await selectProvider("datago");

    expect(await screen.findByRole("button", { name: "등록하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("credential GET 503은 '저장소 미구성'으로 구분해서 표시한다", async () => {
    mswServer.use(
      http.get(`${API_BASE}/providers/datago/credential`, () =>
        HttpResponse.json({ error: "credential store is not configured" }, { status: 503 }),
      ),
    );
    renderProviders();
    await selectProvider("datago");

    expect(
      await screen.findByText("자격 증명 저장소가 아직 구성되지 않았습니다", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    // 일반 오류 문구나 등록/삭제 컨트롤로 오인되지 않는다.
    expect(screen.queryByText("자격 증명 상태를 불러오지 못했습니다")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "등록하기" })).not.toBeInTheDocument();
  });
});

describe("ProviderPage provider 전환 race", () => {
  it("A 조회가 pending인 동안 B로 전환하면 A의 늦은 응답이 B 패널을 덮지 않는다", async () => {
    mswServer.use(
      http.get(`${API_BASE}/providers/datago/credential`, async () => {
        await delay(250);
        return HttpResponse.json({
          configured: true,
          masked: "DATAGO-STALE",
          updated_at: "2026-08-15T09:25:00+00:00",
        });
      }),
      http.get(`${API_BASE}/providers/kosis/credential`, () =>
        HttpResponse.json({ configured: false, masked: null, updated_at: null }),
      ),
    );
    renderProviders();

    await selectProvider("datago");
    await selectProvider("kosis");

    // kosis는 자기 상태(미등록)를 보여준다.
    expect(await screen.findByRole("button", { name: "등록하기" })).toBeInTheDocument();

    // datago의 늦은 응답이 도착할 시간을 준다.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText(/DATAGO-STALE/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();
  });

  it("A credential 저장 완료 후의 늦은 metadata refresh도 B 패널을 덮지 않는다", async () => {
    let datagoStored = false;
    let datagoCredentialGets = 0;
    mswServer.use(
      http.get(`${API_BASE}/providers/datago/credential`, () => {
        datagoCredentialGets += 1;
        return HttpResponse.json(
          datagoStored
            ? { configured: true, masked: "DATAGO-NEWKEY", updated_at: "2026-09-01T00:00:00+00:00" }
            : { configured: false, masked: null, updated_at: null },
        );
      }),
      http.put(`${API_BASE}/providers/datago/credential`, async () => {
        await delay(250);
        datagoStored = true;
        return HttpResponse.json({
          provider: "datago",
          configured: true,
          masked: "DATAGO-NEWKEY",
          updated_at: "2026-09-01T00:00:00+00:00",
        });
      }),
      http.get(`${API_BASE}/providers/kosis/credential`, () =>
        HttpResponse.json({ configured: false, masked: null, updated_at: null }),
      ),
    );
    renderProviders();

    await selectProvider("datago");
    fireEvent.click(await screen.findByRole("button", { name: "등록하기" }));
    fireEvent.change(screen.getByPlaceholderText("API Key를 입력하세요"), {
      target: { value: "typed-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    // 저장이 진행 중인 동안 B로 전환.
    await selectProvider("kosis");
    expect(await screen.findByRole("button", { name: "등록하기" })).toBeInTheDocument();

    // 임의 sleep 대신, PUT 완료 후의 loadCredentialMeta(datago) refresh가 실제로
    // 발생했음을 GET 횟수로 결정적으로 기다린다(초기 조회 1 + mutation 후 refresh 1).
    // waitFor가 폴링을 act()로 감싸므로 뒤늦은 state 갱신도 act 안에서 flush된다.
    await waitFor(() => expect(datagoCredentialGets).toBeGreaterThanOrEqual(2));

    expect(screen.queryByText(/DATAGO-NEWKEY/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();
  });
});
