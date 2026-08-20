/**
 * loadCatalog (#249) mock/real 분기 테스트.
 *
 * mock 모드에서는 네트워크를 전혀 치지 않고 결정적 fixture를 반환하고, 실연동 모드에서는
 * Builder GET /catalog를 호출하는지 확인한다(#246 mock/real 구분 원칙).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCatalog } from "./api";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loadCatalog (#249)", () => {
  describe("mock mode", () => {
    it("does not make a network call", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await loadCatalog();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns a deterministic catalog with multiple providers and a mix of requires_service_key", async () => {
      const catalog = await loadCatalog();
      expect(catalog.providers.length).toBeGreaterThan(1);

      const allDatasets = catalog.providers.flatMap((provider) => provider.datasets);
      expect(allDatasets.some((dataset) => dataset.requires_service_key)).toBe(true);
      expect(allDatasets.some((dataset) => !dataset.requires_service_key)).toBe(true);
    });
  });

  describe("real integration mode", () => {
    it("calls Builder GET /catalog and returns the parsed response", async () => {
      vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(200, {
          providers: [{ name: "datago", datasets: [{ name: "air", title: "대기질", requires_service_key: true }] }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const catalog = await loadCatalog();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain("/catalog");
      expect(catalog.providers[0].name).toBe("datago");
    });
  });
});
