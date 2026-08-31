import { describe, expect, it } from "vitest";
import { parseOidcIssuer, resolveDevAuthBypass, resolveOidcConfig } from "./env";

describe("resolveDevAuthBypass", () => {
  it("requires both development mode and an explicit true value", () => {
    expect(resolveDevAuthBypass({ dev: true, bypass: "true" })).toBe(true);
    expect(resolveDevAuthBypass({ dev: true, bypass: "false" })).toBe(false);
    expect(resolveDevAuthBypass({ dev: true })).toBe(false);
  });

  it("fails closed in production even when the bypass variable is true", () => {
    expect(resolveDevAuthBypass({ dev: false, bypass: "true" })).toBe(false);
  });
});

describe("parseOidcIssuer", () => {
  it("splits a standard Keycloak issuer into base URL + realm", () => {
    expect(parseOidcIssuer("http://localhost:8080/realms/kpubdata")).toEqual({
      authServerUrl: "http://localhost:8080",
      realm: "kpubdata",
    });
  });

  it("keeps a path prefix in front of /realms", () => {
    expect(parseOidcIssuer("https://id.example.com/auth/realms/kpubdata")).toEqual({
      authServerUrl: "https://id.example.com/auth",
      realm: "kpubdata",
    });
  });

  it("rejects malformed issuers (no /realms, wrong protocol, query/hash, garbage)", () => {
    expect(parseOidcIssuer("http://localhost:8080/kpubdata")).toBeNull();
    expect(parseOidcIssuer("ftp://localhost:8080/realms/kpubdata")).toBeNull();
    expect(parseOidcIssuer("http://localhost:8080/realms/kpubdata?x=1")).toBeNull();
    expect(parseOidcIssuer("not a url")).toBeNull();
    expect(parseOidcIssuer("http://localhost:8080/realms/")).toBeNull();
  });
});

describe("resolveOidcConfig", () => {
  const base = {
    realBuilder: true,
    devBypass: false,
    issuer: "http://localhost:8080/realms/kpubdata",
    clientId: "kpubdata-studio",
  };

  it("returns ok with a parsed config for a valid real-mode setup", () => {
    expect(resolveOidcConfig(base)).toEqual({
      status: "ok",
      config: {
        issuer: "http://localhost:8080/realms/kpubdata",
        authServerUrl: "http://localhost:8080",
        realm: "kpubdata",
        clientId: "kpubdata-studio",
      },
    });
  });

  it("is disabled in mock mode even without any OIDC env", () => {
    expect(resolveOidcConfig({ realBuilder: false, devBypass: false })).toEqual({
      status: "disabled",
    });
  });

  it("is disabled when the dev auth bypass is on", () => {
    expect(resolveOidcConfig({ ...base, devBypass: true })).toEqual({ status: "disabled" });
  });

  it("fails closed when the issuer is missing in real mode", () => {
    expect(resolveOidcConfig({ ...base, issuer: undefined }).status).toBe("error");
    expect(resolveOidcConfig({ ...base, issuer: "   " }).status).toBe("error");
  });

  it("fails closed when the client id is missing in real mode", () => {
    expect(resolveOidcConfig({ ...base, clientId: undefined }).status).toBe("error");
  });

  it("fails closed when the issuer is malformed", () => {
    const result = resolveOidcConfig({ ...base, issuer: "http://localhost:8080/oops" });
    expect(result.status).toBe("error");
  });
});
