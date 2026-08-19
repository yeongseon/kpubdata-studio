/**
 * Add Data local draft — secret redaction on save (PR #283 리뷰 대응, Epic #246).
 *
 * url source의 secret query parameter가 localStorage에 평문으로 저장되지 않는지,
 * 저장된 redacted draft를 복원한 뒤 재입력 없이 Preview/Build가 되지 않는지 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAddDataDraft, loadAddDataDraft, saveAddDataDraft } from "./draftStorage";
import { INITIAL_DRAFT, buildSpecFromDraft, type AddDataDraft } from "./model";

function urlDraft(endpoint: string): AddDataDraft {
  return {
    ...INITIAL_DRAFT,
    sourceKind: "url",
    url: { endpoint, format: null },
    datasetId: "d",
    title: "t",
    description: "desc",
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("saveAddDataDraft — secret redaction (#283)", () => {
  it("?token=<secret> 원문이 localStorage에 없다", () => {
    const secret = "eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz012345";
    saveAddDataDraft(urlDraft(`https://api.example.org/v1?token=${secret}`));
    const raw = localStorage.getItem("kpubdata-studio:add-data-draft") ?? "";
    expect(raw).not.toContain(secret);
  });

  it("고엔트로피 credential 값이 key 이름과 무관하게 localStorage에 없다", () => {
    const secret = "Zx8pQ2vR7mK4nL9wT1yB6cU3sD0fH5jA8gE2rN7iM4x";
    saveAddDataDraft(urlDraft(`https://api.example.org/v1?auth=${secret}`));
    const raw = localStorage.getItem("kpubdata-studio:add-data-draft") ?? "";
    expect(raw).not.toContain(secret);
  });

  it("일반 비민감 query parameter는 저장된 초안에서도 유지된다", () => {
    saveAddDataDraft(urlDraft("https://api.example.org/data?region=seoul&year=2024"));
    const raw = localStorage.getItem("kpubdata-studio:add-data-draft") ?? "";
    expect(raw).toContain("region=seoul");
    expect(raw).toContain("year=2024");
  });

  it("저장된 redacted draft를 복원하면 secret 재입력 없이는 Preview/Build를 진행할 수 없다", () => {
    const secret = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";
    saveAddDataDraft(urlDraft(`https://api.example.org/data?api_key=${secret}`));

    const restored = loadAddDataDraft();
    expect(restored).not.toBeNull();
    expect(restored!.url.endpoint).not.toContain(secret);

    const result = buildSpecFromDraft(restored!);
    expect(result.spec).toBeUndefined();
    expect(result.error).toMatch(/다시 입력/);
  });

  it("소스가 url이 아니어도 draft.url.endpoint에 남아있던 secret은 저장 시 지워진다", () => {
    const secret = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";
    const draft: AddDataDraft = {
      ...INITIAL_DRAFT,
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
      url: { endpoint: `https://api.example.org/data?api_key=${secret}`, format: null },
    };
    saveAddDataDraft(draft);
    const raw = localStorage.getItem("kpubdata-studio:add-data-draft") ?? "";
    expect(raw).not.toContain(secret);
  });
});

describe("clearAddDataDraft", () => {
  it("저장된 초안을 지운다", () => {
    saveAddDataDraft(urlDraft("https://api.example.org/data"));
    clearAddDataDraft();
    expect(loadAddDataDraft()).toBeNull();
  });
});
