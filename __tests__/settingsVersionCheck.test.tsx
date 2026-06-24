/**
 * SettingsPage 계약 버전 호환성 점검 테스트 (#75).
 *
 * Builder가 보고한 api_version이 Studio의 API_CONTRACT_VERSION과 다르면 화면에 버전 불일치
 * 경고가 표면화되는지, 일치하면 경고가 없는지를 검증한다.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const version = vi.fn();
const isRealBuilderEnabled = vi.fn(() => true);

vi.mock("@/shared/lib/builderApi", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/builderApi")>(
    "@/shared/lib/builderApi",
  );
  return {
    ...actual,
    isRealBuilderEnabled: () => isRealBuilderEnabled(),
    builderApi: { ...actual.builderApi, version: (...args: unknown[]) => version(...args) },
  };
});

const { SettingsPage } = await import("@/pages/SettingsPage");
const { API_CONTRACT_VERSION } = await import("@/shared/lib/builderApi");

afterEach(() => {
  version.mockReset();
  isRealBuilderEnabled.mockReturnValue(true);
});

describe("SettingsPage version check", () => {
  it("surfaces a warning when builder api_version mismatches the studio contract", async () => {
    version.mockResolvedValue({ service: "builder", api_version: "2.0.0" });
    render(<SettingsPage />);

    const warning = await screen.findByRole("alert");
    expect(warning.textContent).toContain("계약 버전 불일치");
    expect(warning.textContent).toContain("2.0.0");
  });

  it("shows no mismatch warning when versions agree", async () => {
    version.mockResolvedValue({ service: "builder", api_version: API_CONTRACT_VERSION });
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByText(new RegExp(`Builder API 버전 ${API_CONTRACT_VERSION}`))).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
