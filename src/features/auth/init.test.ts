/**
 * initAuth (auth ↔ builderApi 배선 + OIDC 부트스트랩) 테스트.
 *
 * keycloak-js SDK 경계는 mock한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockKeycloak, KeycloakCtor } = vi.hoisted(() => {
  const mk = {
    authenticated: false as boolean,
    token: undefined as string | undefined,
    tokenParsed: undefined as unknown,
    init: vi.fn(),
    updateToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    onAuthSuccess: undefined as undefined | (() => void),
    onAuthRefreshSuccess: undefined as undefined | (() => void),
    onAuthLogout: undefined as undefined | (() => void),
    onTokenExpired: undefined as undefined | (() => void),
  };
  return { mockKeycloak: mk, KeycloakCtor: vi.fn(function () { return mk; }) };
});

vi.mock("keycloak-js", () => ({ default: KeycloakCtor }));

import { __resetKeycloakForTests } from "./keycloak";
import { initAuth } from "./init";
import { useAuthStore } from "./store";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.stubEnv("VITE_USE_REAL_BUILDER", "true");
  vi.stubEnv("VITE_OIDC_ISSUER", "http://localhost:8080/realms/kpubdata");
  vi.stubEnv("VITE_OIDC_CLIENT_ID", "kpubdata-studio");
  vi.stubEnv("VITE_DEV_BYPASS_AUTH", "false");

  KeycloakCtor.mockClear();
  mockKeycloak.authenticated = false;
  mockKeycloak.token = undefined;
  mockKeycloak.tokenParsed = undefined;
  mockKeycloak.init.mockReset().mockResolvedValue(false);
  mockKeycloak.updateToken.mockReset().mockResolvedValue(true);
  mockKeycloak.onAuthLogout = undefined;
  __resetKeycloakForTests();
  useAuthStore.getState().clear();
  useAuthStore.setState({ oidcStatus: "disabled" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetKeycloakForTests();
});

describe("initAuth — OIDC disabled (mock mode regression)", () => {
  it("leaves oidcStatus 'disabled' and never constructs Keycloak", async () => {
    vi.stubEnv("VITE_USE_REAL_BUILDER", "false");
    initAuth();
    await flush();
    expect(useAuthStore.getState().oidcStatus).toBe("disabled");
    expect(KeycloakCtor).not.toHaveBeenCalled();
  });
});

describe("initAuth — OIDC misconfigured (fail closed)", () => {
  it("sets oidcStatus 'error' without assuming the user is authenticated", async () => {
    vi.stubEnv("VITE_OIDC_ISSUER", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    initAuth();
    await flush();

    expect(useAuthStore.getState().oidcStatus).toBe("error");
    expect(useAuthStore.getState().email).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("initAuth — OIDC enabled", () => {
  it("goes initializing → authenticated and records the identity from token claims", async () => {
    mockKeycloak.init.mockResolvedValue(true);
    mockKeycloak.authenticated = true;
    mockKeycloak.tokenParsed = { email: "tester@example.com", name: "테스터" };

    initAuth();
    // 동기 지점에서는 이미 initializing.
    expect(useAuthStore.getState().oidcStatus).toBe("initializing");

    await flush();

    expect(useAuthStore.getState().oidcStatus).toBe("authenticated");
    expect(useAuthStore.getState().email).toBe("tester@example.com");
    expect(useAuthStore.getState().name).toBe("테스터");
    // raw token은 store에 저장하지 않는다.
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("goes initializing → unauthenticated when no existing session is found", async () => {
    mockKeycloak.init.mockResolvedValue(false);
    initAuth();
    await flush();
    expect(useAuthStore.getState().oidcStatus).toBe("unauthenticated");
  });

  it("fails closed to 'error' when init rejects (no retry loop)", async () => {
    mockKeycloak.init.mockRejectedValue(new Error("kc down"));
    initAuth();
    await flush();
    expect(useAuthStore.getState().oidcStatus).toBe("error");
  });

  it("clears the session on a Keycloak logout event", async () => {
    mockKeycloak.init.mockResolvedValue(true);
    mockKeycloak.authenticated = true;
    mockKeycloak.tokenParsed = { email: "tester@example.com" };

    initAuth();
    await flush();
    expect(useAuthStore.getState().oidcStatus).toBe("authenticated");

    mockKeycloak.onAuthLogout?.();
    expect(useAuthStore.getState().oidcStatus).toBe("unauthenticated");
    expect(useAuthStore.getState().email).toBeNull();
  });
});
