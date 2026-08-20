import { describe, expect, it } from "vitest";
import { parseSourceParams } from "./paramsInput";

describe("parseSourceParams", () => {
  it("preserves the complete canonical JSON value shape", () => {
    const result = parseSourceParams(JSON.stringify({
      text: "abc",
      page: 1,
      enabled: true,
      nullable: null,
      filters: ["서울", "경기"],
      options: { limit: 20, nested: { flag: false } },
    }));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      text: "abc",
      page: 1,
      enabled: true,
      nullable: null,
      filters: ["서울", "경기"],
      options: { limit: 20, nested: { flag: false } },
    });
  });

  it("rejects non-finite numbers", () => {
    expect(parseSourceParams('{"page": 1e400}').error).toBeTruthy();
  });
});
