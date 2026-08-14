import { afterEach, describe, expect, it } from "vitest";
import { saveBuildSpec } from "@/features/build-spec/specStore";
import { loadDraft } from "@/features/build-spec/draftStorage";
import { buildFormValuesSchema } from "@/shared/lib/schemas";
import type { BuildSpec } from "@/shared/lib/types";
import {
  actionHref,
  applyAddReportBlock,
  applyBuildSpecPatch,
  applyCreateBuildDraft,
  describeAction,
  draftValuesFromAction,
  previewBuildSpecPatch,
} from "./actions";
import { listKubiReportNotes } from "./reportInbox";
import type { KubiAction } from "./schema";

const BASE_SPEC: BuildSpec = {
  datasetId: "air-quality",
  title: "대기질",
  description: "설명",
  sources: [{ provider: "datago", dataset: "air_quality", params: { region: "서울" } }],
  exports: [{ format: "jsonl" }],
  metadata: { note: "orig" },
};

afterEach(() => {
  localStorage.clear();
});

describe("previewBuildSpecPatch / applyBuildSpecPatch (#256 §10)", () => {
  it("fails when no spec is stored for the run (Builder doesn't persist specs)", () => {
    const action: Extract<KubiAction, { type: "PATCH_BUILDSPEC" }> = {
      type: "PATCH_BUILDSPEC",
      runId: "unknown-run",
      patch: [{ op: "replace", path: "/title", value: "x" }],
      reason: "test",
    };
    const preview = previewBuildSpecPatch(action);
    expect(preview.ok).toBe(false);
  });

  it("rejects a patch path outside the allowlist (e.g. datasetId identity swap)", () => {
    saveBuildSpec("run-1", BASE_SPEC);
    const action: Extract<KubiAction, { type: "PATCH_BUILDSPEC" }> = {
      type: "PATCH_BUILDSPEC",
      runId: "run-1",
      patch: [{ op: "replace", path: "/datasetId", value: "swapped" }],
      reason: "test",
    };
    const preview = previewBuildSpecPatch(action);
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.reason).toMatch(/허용되지 않은 경로/);
  });

  it("rejects a patch that would rewrite the source provider/dataset identity", () => {
    saveBuildSpec("run-1", BASE_SPEC);
    const action: Extract<KubiAction, { type: "PATCH_BUILDSPEC" }> = {
      type: "PATCH_BUILDSPEC",
      runId: "run-1",
      patch: [{ op: "replace", path: "/sources/0/provider", value: "other" }],
      reason: "test",
    };
    expect(previewBuildSpecPatch(action).ok).toBe(false);
  });

  it("produces a before/after diff for an allowed metadata patch", () => {
    saveBuildSpec("run-1", BASE_SPEC);
    const action: Extract<KubiAction, { type: "PATCH_BUILDSPEC" }> = {
      type: "PATCH_BUILDSPEC",
      runId: "run-1",
      patch: [{ op: "replace", path: "/metadata/note", value: "updated" }],
      reason: "test",
    };
    const preview = previewBuildSpecPatch(action);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.before.metadata.note).toBe("orig");
      expect(preview.after.metadata.note).toBe("updated");
      // 건드리지 않은 필드는 그대로 보존된다.
      expect(preview.after.sources).toEqual(BASE_SPEC.sources);
      expect(preview.after.exports).toEqual(BASE_SPEC.exports);
    }
  });

  it("applies an approved patch: saves it and re-runs Builder /validate", async () => {
    saveBuildSpec("run-1", BASE_SPEC);
    const action: Extract<KubiAction, { type: "PATCH_BUILDSPEC" }> = {
      type: "PATCH_BUILDSPEC",
      runId: "run-1",
      patch: [{ op: "add", path: "/sources/0/params/foo", value: "bar" }],
      reason: "test",
    };
    const preview = previewBuildSpecPatch(action);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const result = await applyBuildSpecPatch("run-1", preview.after);
    expect(result.valid).toBe(true); // mock 모드에서는 항상 valid
  });
});

describe("draftValuesFromAction / applyCreateBuildDraft (#256)", () => {
  it("fills sane defaults for optional fields", () => {
    const action: Extract<KubiAction, { type: "CREATE_BUILD_DRAFT" }> = {
      type: "CREATE_BUILD_DRAFT",
      values: { datasetId: "d1", title: "t", description: "d", provider: "datago", sourceDataset: "air_quality" },
      reason: "test",
    };
    const values = draftValuesFromAction(action);
    expect(buildFormValuesSchema.safeParse(values).success).toBe(true);
    expect(values.sourceParams).toBe("{}");
    expect(values.exportFormats).toEqual(["jsonl"]);
    expect(values.outputPath).toContain("d1");
  });

  it("writes to the New Build wizard's single draft slot", () => {
    const action: Extract<KubiAction, { type: "CREATE_BUILD_DRAFT" }> = {
      type: "CREATE_BUILD_DRAFT",
      values: { datasetId: "d1", title: "t", description: "d", provider: "datago", sourceDataset: "air_quality" },
      reason: "test",
    };
    applyCreateBuildDraft(action);
    const stored = loadDraft(buildFormValuesSchema);
    expect(stored?.datasetId).toBe("d1");
  });
});

describe("applyAddReportBlock (#256, #258 handoff only)", () => {
  it("queues the note with its context instead of writing into Reports directly", () => {
    const action: Extract<KubiAction, { type: "ADD_REPORT_BLOCK" }> = {
      type: "ADD_REPORT_BLOCK",
      note: "가격 결측이 특정 지역에 집중됩니다.",
      reason: "test",
    };
    applyAddReportBlock(action, { page: "quality", datasetId: "d1", runId: "r1", stage: "gold" });
    const notes = listKubiReportNotes();
    expect(notes.at(-1)?.note).toBe(action.note);
    expect(notes.at(-1)?.context).toEqual({ datasetId: "d1", runId: "r1", stage: "gold" });
  });
});

describe("actionHref / describeAction", () => {
  it("computes navigation targets for OPEN_* actions", () => {
    expect(actionHref({ type: "OPEN_PROVIDER", provider: "datago", reason: "x" })).toBe("/provider");
    expect(actionHref({ type: "OPEN_BUILD", runId: "run-1", reason: "x" })).toBe("/builds/run-1");
    expect(actionHref({ type: "OPEN_QUALITY", datasetId: "d1", runId: "r1", stage: "gold", reason: "x" })).toBe(
      "/quality?dataset=d1&run=r1&stage=gold",
    );
  });

  it("returns null for actions with no direct navigation target", () => {
    expect(
      actionHref({ type: "PATCH_BUILDSPEC", runId: "r1", patch: [{ op: "replace", path: "/title", value: "x" }], reason: "x" }),
    ).toBeNull();
    expect(
      actionHref({
        type: "CREATE_BUILD_DRAFT",
        values: { datasetId: "d1", title: "t", description: "d", provider: "p", sourceDataset: "s" },
        reason: "x",
      }),
    ).toBeNull();
    expect(actionHref({ type: "ADD_REPORT_BLOCK", note: "n", reason: "x" })).toBeNull();
  });

  it("describes every action type in Korean", () => {
    const actions: KubiAction[] = [
      { type: "OPEN_PROVIDER", provider: "datago", reason: "x" },
      { type: "OPEN_BUILD", runId: "r1", reason: "x" },
      { type: "OPEN_QUALITY", datasetId: "d1", reason: "x" },
      { type: "PATCH_BUILDSPEC", runId: "r1", patch: [{ op: "replace", path: "/title", value: "x" }], reason: "x" },
      {
        type: "CREATE_BUILD_DRAFT",
        values: { datasetId: "d1", title: "t", description: "d", provider: "p", sourceDataset: "s" },
        reason: "x",
      },
      { type: "ADD_REPORT_BLOCK", note: "n", reason: "x" },
    ];
    for (const action of actions) {
      expect(describeAction(action).length).toBeGreaterThan(0);
    }
  });
});
