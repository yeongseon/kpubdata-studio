import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  clearDraft,
  DRAFT_VERSION,
  hasDraft,
  loadDraft,
  saveDraft,
} from "@/features/build-spec/draftStorage";

const DRAFT_KEY = "kpubdata-studio:new-build-draft";

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
    localStorage.setItem(DRAFT_KEY, "{not json");
    expect(loadDraft()).toBeNull();
  });

  it("wraps the saved value in a versioned envelope (#84)", () => {
    saveDraft({ title: "기상" });
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
    expect(raw.version).toBe(DRAFT_VERSION);
    expect(raw.data).toEqual({ title: "기상" });
    expect(typeof raw.savedAt).toBe("string");
  });

  it("ignores and clears a draft saved under a different version (#84)", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: DRAFT_VERSION + 1, data: { title: "old" }, savedAt: "x" }),
    );
    expect(loadDraft()).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  it("ignores and clears a draft that fails schema validation (#84)", () => {
    const schema = z.object({ title: z.string() });
    saveDraft({ title: 123 }); // 잘못된 타입(스키마 위반)
    expect(loadDraft(schema)).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  it("returns the data when it passes schema validation (#84)", () => {
    const schema = z.object({ title: z.string() });
    saveDraft({ title: "ok" });
    expect(loadDraft(schema)).toEqual({ title: "ok" });
  });
});
