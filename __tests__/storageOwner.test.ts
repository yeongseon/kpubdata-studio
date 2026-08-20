/**
 * 사용자별 localStorage 저장 격리 테스트 (#293).
 *
 * - 로그인 사용자마다 별도 버킷(Saved BuildSpec/Report/초안)
 * - 로그아웃 상태는 기존 무소속 키(하위 호환, 데모 데이터 무손실)
 * - 다른 사용자 로그인 시 이전 사용자 초안 자동 복원 없음
 * - 전체 삭제는 현재 소유자 버킷만
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/features/auth/store";
import { ownedStorageKey, resolveStorageOwnerKey } from "@/features/auth/storageOwner";
import { clearAllSavedSpecs, createSavedSpec, listSavedSpecSummaries } from "@/features/workspace/savedSpecs";
import { saveDraft, loadDraft } from "@/features/build-spec/draftStorage";

function emptySpec() {
  return {
    datasetId: "demo",
    title: "demo",
    description: "",
    sources: [],
    exports: [],
    metadata: {},
  } as never;
}

describe("storageOwner (#293)", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    localStorage.clear();
    useAuthStore.getState().clear();
  });

  it("미로그인은 무소속 키를 그대로 쓴다(하위 호환)", () => {
    expect(ownedStorageKey("kpubdata-studio:saved-build-specs")).toBe(
      "kpubdata-studio:saved-build-specs",
    );
    expect(resolveStorageOwnerKey()).toBe("anonymous");
  });

  it("이메일을 정규화(trim+lowercase)한 소유자 키로 네임스페이싱한다", () => {
    useAuthStore.getState().setSession({
      token: "t",
      email: "  User@Example.COM ",
      name: null,
      provider: "mock",
    });

    expect(resolveStorageOwnerKey()).toBe("user:user@example.com");
    expect(ownedStorageKey("kpubdata-studio:saved-build-specs")).toBe(
      "kpubdata-studio:saved-build-specs:user:user@example.com",
    );
  });

  it("사용자마다 Saved BuildSpec 버킷이 분리된다", () => {
    useAuthStore.getState().setSession({
      token: "t1",
      email: "a@example.com",
      name: null,
      provider: "mock",
    });
    createSavedSpec({ name: "A의 스펙", spec: emptySpec(), validation: { status: "not_validated", errors: [] } });
    expect(listSavedSpecSummaries()).toHaveLength(1);

    useAuthStore.getState().setSession({
      token: "t2",
      email: "b@example.com",
      name: null,
      provider: "mock",
    });
    expect(listSavedSpecSummaries()).toHaveLength(0);

    useAuthStore.getState().clear();
    expect(listSavedSpecSummaries()).toHaveLength(0);
  });

  it("다른 사용자 로그인 시 이전 사용자 초안이 자동으로 열리지 않는다", () => {
    useAuthStore.getState().setSession({
      token: "t1",
      email: "a@example.com",
      name: null,
      provider: "mock",
    });
    saveDraft({ title: "A의 초안" });

    useAuthStore.getState().setSession({
      token: "t2",
      email: "b@example.com",
      name: null,
      provider: "mock",
    });
    expect(loadDraft<{ title: string }>()).toBeNull();
  });

  it("전체 삭제는 현재 소유자 버킷만 지운다", () => {
    useAuthStore.getState().setSession({
      token: "t1",
      email: "a@example.com",
      name: null,
      provider: "mock",
    });
    createSavedSpec({ name: "A의 스펙", spec: emptySpec(), validation: { status: "not_validated", errors: [] } });

    useAuthStore.getState().setSession({
      token: "t2",
      email: "b@example.com",
      name: null,
      provider: "mock",
    });
    createSavedSpec({ name: "B의 스펙", spec: emptySpec(), validation: { status: "not_validated", errors: [] } });

    expect(clearAllSavedSpecs()).toBe(true);
    expect(listSavedSpecSummaries()).toHaveLength(0);

    useAuthStore.getState().setSession({
      token: "t1",
      email: "a@example.com",
      name: null,
      provider: "mock",
    });
    expect(listSavedSpecSummaries()).toHaveLength(1);
  });
});
