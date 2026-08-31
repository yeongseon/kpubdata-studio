import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginGate } from "./LoginGate";
import { useAuthStore } from "./store";

// LoginGate는 로그인 버튼용으로 ./keycloak을 import한다 — SDK 경계는 mock한다.
vi.mock("keycloak-js", () => ({ default: vi.fn(() => ({})) }));

function renderGate() {
  return render(
    <MemoryRouter>
      <LoginGate><div>protected content</div></LoginGate>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  useAuthStore.getState().clear();
  useAuthStore.setState({ oidcStatus: "disabled" });
});

describe("LoginGate", () => {
  it("renders children in mock mode without a token", () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "false");
    renderGate();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("requires login in real Builder mode when bypass is off (OIDC disabled)", () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubEnv("VITE_DEV_BYPASS_AUTH", "false");
    renderGate();
    expect(screen.getByRole("link", { name: /로그인 페이지/ })).toBeInTheDocument();
  });

  it("renders children in real Builder development mode when bypass is explicitly on", () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    vi.stubEnv("VITE_DEV_BYPASS_AUTH", "true");
    renderGate();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("renders children in real Builder mode when a legacy memory token exists", () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
    useAuthStore.getState().setToken("existing-token");
    renderGate();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  describe("OIDC status (real Builder, bypass off)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
      vi.stubEnv("VITE_DEV_BYPASS_AUTH", "false");
    });

    it("shows a loading notice while OIDC is initializing", () => {
      useAuthStore.setState({ oidcStatus: "initializing" });
      renderGate();
      expect(screen.getByText(/확인하는 중/)).toBeInTheDocument();
      expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    });

    it("renders children once OIDC reports authenticated", () => {
      useAuthStore.setState({ oidcStatus: "authenticated" });
      renderGate();
      expect(screen.getByText("protected content")).toBeInTheDocument();
    });

    it("fails closed with an error notice when OIDC init fails", () => {
      useAuthStore.setState({ oidcStatus: "error" });
      renderGate();
      expect(screen.getByText(/초기화하지 못했습니다/)).toBeInTheDocument();
      expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    });

    it("offers a Keycloak login CTA when unauthenticated", () => {
      useAuthStore.setState({ oidcStatus: "unauthenticated" });
      renderGate();
      expect(screen.getByRole("button", { name: /Keycloak/ })).toBeInTheDocument();
      expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    });
  });
});
