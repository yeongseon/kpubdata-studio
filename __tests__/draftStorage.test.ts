import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, hasDraft, loadDraft, saveDraft } from "@/features/build-spec/draftStorage";

describe("draftStorage", () => {
  beforeEach(() => clearDraft());

  it("reports no draft initially", () => {
    expect(hasDraft()).toBe(false);
    expect(loadDraft()).toBeNull();
  });

  it("saves and loads a draft round-trip", () => {
    saveDraft({ datasetId: "kma-daily", title: "기상" });
    expect(hasDraft()).toBe(true);
    expect(loadDraft<{ datasetId: string; title: string }>()).toEqual({
      datasetId: "kma-daily",
      title: "기상",
    });
  });

  it("clears a saved draft", () => {
    saveDraft({ a: 1 });
    clearDraft();
    expect(hasDraft()).toBe(false);
  });

  it("returns null on corrupted data", () => {
    localStorage.setItem("kpubdata-studio:new-build-draft", "{not json");
    expect(loadDraft()).toBeNull();
  });
});
