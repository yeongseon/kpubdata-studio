/**
 * useAuthStore (#188, #263 generic 세션 확장) 테스트.
 *
 * setToken(Google, 하위 호환)과 setSession(mock/generic AuthProvider)이 같은 store를
 * 공유하면서 서로의 필드를 오염시키지 않는지, 그리고 password가 store 어디에도 남지
 * 않는지 확인한다.
 */
import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./store";
import type { AuthSession } from "./types";

afterEach(() => {
  useAuthStore.getState().clear();
});

describe("useAuthStore", () => {
  it("starts logged out", () => {
    const state = useAuthStore.getState();
    expect(state).toMatchObject({ token: null, email: null, name: null, providerId: null });
  });

  it("setToken (Google 하위 호환) sets token/email and tags the session as google", () => {
    useAuthStore.getState().setToken("google-jwt", "user@example.com");
    expect(useAuthStore.getState()).toMatchObject({
      token: "google-jwt",
      email: "user@example.com",
      name: null,
      providerId: "google",
    });
  });

  it("setToken(null) clears the session and providerId", () => {
    useAuthStore.getState().setToken("google-jwt", "user@example.com");
    useAuthStore.getState().setToken(null);
    expect(useAuthStore.getState()).toMatchObject({ token: null, email: null, providerId: null });
  });

  it("setSession stores a full generic AuthSession (mock/#263)", () => {
    const session: AuthSession = {
      token: "mock-session-abc",
      email: "person@example.com",
      name: "홍길동",
      provider: "mock",
    };
    useAuthStore.getState().setSession(session);
    expect(useAuthStore.getState()).toMatchObject({
      token: "mock-session-abc",
      email: "person@example.com",
      name: "홍길동",
      providerId: "mock",
    });
  });

  it("clear resets every field regardless of which provider logged in", () => {
    useAuthStore.getState().setSession({
      token: "mock-session-abc",
      email: "person@example.com",
      name: "홍길동",
      provider: "mock",
    });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      email: null,
      name: null,
      providerId: null,
    });
  });

  it("never stores a password field — the state shape only has session data", () => {
    useAuthStore.getState().setSession({
      token: "mock-session-abc",
      email: "person@example.com",
      name: "홍길동",
      provider: "mock",
    });
    const state = useAuthStore.getState();
    expect(Object.keys(state)).not.toContain("password");
    expect(JSON.stringify(state)).not.toMatch(/password/i);
  });
});
