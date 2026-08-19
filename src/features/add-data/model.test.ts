import { describe, expect, it } from "vitest";
import {
  INITIAL_DRAFT,
  applyBuildSpecToDraft,
  buildSpecFromDraft,
  draftSignature,
  redactBuildSpecForDisplay,
  type AddDataDraft,
} from "./model";

function draftWith(overrides: Partial<AddDataDraft>): AddDataDraft {
  return { ...INITIAL_DRAFT, datasetId: "d", title: "t", description: "desc", ...overrides };
}

describe("buildSpecFromDraft", () => {
  it("소스를 선택하지 않으면 오류를 반환한다", () => {
    const result = buildSpecFromDraft(INITIAL_DRAFT);
    expect(result.error).toMatch(/Source를 먼저 선택/);
    expect(result.spec).toBeUndefined();
  });

  it("public_api: provider/dataset/params로 유효한 spec을 만든다", () => {
    const draft = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: '{"region":"seoul"}' },
    });
    const result = buildSpecFromDraft(draft);
    expect(result.error).toBeUndefined();
    expect(result.spec?.sources[0]).toMatchObject({
      provider: "datago",
      dataset: "apt_trade",
      params: { region: "seoul" },
    });
  });

  it("public_api: 잘못된 JSON 파라미터는 오류를 반환한다", () => {
    const draft = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{not json" },
    });
    expect(buildSpecFromDraft(draft).error).toMatch(/JSON/);
  });

  it("file: 업로드 전이면 오류를 반환한다", () => {
    const draft = draftWith({ sourceKind: "file" });
    expect(buildSpecFromDraft(draft).error).toMatch(/파일을 업로드/);
  });

  it("file: upload_id/format이 있으면 kind='file' spec을 만든다", () => {
    const draft = draftWith({
      sourceKind: "file",
      file: { uploadId: "upl_0123456789abcdef0123456789abcdef", format: "csv", encoding: "utf-8", filename: "a.csv", sizeBytes: 10 },
    });
    const result = buildSpecFromDraft(draft);
    expect(result.error).toBeUndefined();
    expect(result.spec?.sources[0]).toMatchObject({
      kind: "file",
      uploadId: "upl_0123456789abcdef0123456789abcdef",
      format: "csv",
    });
  });

  it("url: https가 아니면 오류를 반환한다", () => {
    const draft = draftWith({ sourceKind: "url", url: { endpoint: "http://insecure.example.org", format: null } });
    expect(buildSpecFromDraft(draft).error).toMatch(/https/);
  });

  it("url: https endpoint면 kind='url' spec을 만든다(Auth 필드 없음)", () => {
    const draft = draftWith({ sourceKind: "url", url: { endpoint: "https://api.example.org/data", format: "json" } });
    const result = buildSpecFromDraft(draft);
    expect(result.error).toBeUndefined();
    expect(result.spec?.sources[0]).toMatchObject({
      kind: "url",
      endpoint: "https://api.example.org/data",
      method: "GET",
      format: "json",
    });
    expect(result.spec?.sources[0]).not.toHaveProperty("timeout");
  });

  it("url: redact된 secret placeholder가 남은 endpoint는 fail-closed로 재입력을 요구한다 (#283, Epic #246)", () => {
    const draft = draftWith({
      sourceKind: "url",
      url: { endpoint: "https://api.example.org/data?api_key=REDACTED", format: null },
    });
    const result = buildSpecFromDraft(draft);
    expect(result.spec).toBeUndefined();
    expect(result.error).toMatch(/다시 입력/);
  });

  it("출력 형식이 비어 있으면 오류를 반환한다", () => {
    const draft = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
      exportFormats: [],
    });
    expect(buildSpecFromDraft(draft).error).toMatch(/출력 형식/);
  });
});

describe("draftSignature", () => {
  it("동일 draft는 동일 signature를 만든다", () => {
    const draft = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
    });
    expect(draftSignature(draft)).toBe(draftSignature({ ...draft }));
  });

  it("source config가 바뀌면 signature도 바뀐다(stale preview 감지, #250)", () => {
    const base = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
    });
    const changed = { ...base, publicApi: { ...base.publicApi, dataset: "other_dataset" } };
    expect(draftSignature(base)).not.toBe(draftSignature(changed));
  });

  it("preview limit/sample_mode가 바뀌면 signature도 바뀐다", () => {
    const base = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
    });
    expect(draftSignature(base)).not.toBe(draftSignature({ ...base, previewLimit: 20 }));
    expect(draftSignature(base)).not.toBe(draftSignature({ ...base, previewSampleMode: "random" }));
  });

  it("컬럼 뷰(key/all) 토글은 signature에 영향을 주지 않는다(새 Preview 호출 불필요)", () => {
    const base = draftWith({
      sourceKind: "public_api",
      publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" },
    });
    expect(draftSignature(base)).toBe(draftSignature({ ...base, previewColumns: "all" }));
  });
});

describe("applyBuildSpecToDraft", () => {
  it("public_api spec을 draft.publicApi로 되반영한다", () => {
    const result = buildSpecFromDraft(
      draftWith({
        sourceKind: "public_api",
        publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: '{"region":"seoul"}' },
      }),
    );
    const applied = applyBuildSpecToDraft(INITIAL_DRAFT, result.spec!);
    expect(applied.sourceKind).toBe("public_api");
    expect(applied.publicApi.provider).toBe("datago");
    expect(applied.publicApi.dataset).toBe("apt_trade");
    expect(applied.datasetId).toBe(result.spec!.datasetId);
  });

  it("file spec을 draft.file로 되반영한다", () => {
    const result = buildSpecFromDraft(
      draftWith({
        sourceKind: "file",
        file: { uploadId: "upl_0123456789abcdef0123456789abcdef", format: "csv", encoding: "utf-8", filename: null, sizeBytes: null },
      }),
    );
    const applied = applyBuildSpecToDraft(INITIAL_DRAFT, result.spec!);
    expect(applied.sourceKind).toBe("file");
    expect(applied.file.uploadId).toBe("upl_0123456789abcdef0123456789abcdef");
    expect(applied.file.format).toBe("csv");
  });
});

describe("redactBuildSpecForDisplay (#283 리뷰 대응, Epic #246)", () => {
  it("url source의 secret query parameter를 표시용 사본에서만 가린다", () => {
    const secret = "A7vK2mQ9xP4rT8yW3nC6dF1hJ5sL0zB";
    const result = buildSpecFromDraft(
      draftWith({ sourceKind: "url", url: { endpoint: `https://api.example.org/data?api_key=${secret}`, format: null } }),
    );
    const original = result.spec!;
    const displaySpec = redactBuildSpecForDisplay(original);

    expect((displaySpec.sources[0].endpoint ?? "")).not.toContain(secret);
    // 원본 spec 객체는 변형되지 않는다(다른 곳에서 실제 제출에 계속 쓰인다).
    expect(original.sources[0].endpoint).toContain(secret);
  });

  it("secret이 없는 url source는 그대로 돌려준다", () => {
    const result = buildSpecFromDraft(
      draftWith({ sourceKind: "url", url: { endpoint: "https://api.example.org/data?region=seoul", format: null } }),
    );
    const displaySpec = redactBuildSpecForDisplay(result.spec!);
    expect(displaySpec.sources[0].endpoint).toBe("https://api.example.org/data?region=seoul");
  });

  it("public_api/file source는 손대지 않는다", () => {
    const result = buildSpecFromDraft(
      draftWith({ sourceKind: "public_api", publicApi: { provider: "datago", dataset: "apt_trade", sourceParams: "{}" } }),
    );
    const displaySpec = redactBuildSpecForDisplay(result.spec!);
    expect(displaySpec).toEqual(result.spec);
  });
});
