import { describe, expect, it } from "vitest";
import type { CatalogRequestParameter } from "@/shared/lib/builderApi";
import { checkRequiredParams, exampleParamsText, requiredParamNames } from "./requiredParams";

const sido: CatalogRequestParameter = {
  name: "sidoName",
  required: true,
  description: "조회할 시·도",
  example: "서울",
};

describe("checkRequiredParams", () => {
  it("metadata가 없으면 항상 통과한다(기존 자유 JSON 입력 유지)", () => {
    expect(checkRequiredParams("{}", undefined)).toEqual({});
    expect(checkRequiredParams("{}", [])).toEqual({});
  });

  it("필수 파라미터가 비면 사용자 친화적 오류를 돌려준다", () => {
    expect(checkRequiredParams("{}", [sido]).error).toBe(
      "sidoName 필수 요청 파라미터를 입력해주세요.",
    );
  });

  it("빈 문자열/공백만 있는 값도 누락으로 취급한다", () => {
    expect(checkRequiredParams('{"sidoName": ""}', [sido]).error).toContain("sidoName");
    expect(checkRequiredParams('{"sidoName": "   "}', [sido]).error).toContain("sidoName");
  });

  it("값이 있으면 통과한다", () => {
    expect(checkRequiredParams('{"sidoName": "서울"}', [sido])).toEqual({});
  });

  it("JSON 구문 오류는 여기서 만들지 않는다(별도 경로가 처리)", () => {
    expect(checkRequiredParams("{not json", [sido])).toEqual({});
  });

  it("선택 파라미터는 강제하지 않는다", () => {
    const optional: CatalogRequestParameter = { ...sido, name: "numOfRows", required: false };
    expect(checkRequiredParams("{}", [optional])).toEqual({});
  });
});

describe("requiredParamNames / exampleParamsText", () => {
  it("required 파라미터 이름만 추린다", () => {
    expect(requiredParamNames([sido, { ...sido, name: "pageNo", required: false }])).toEqual([
      "sidoName",
    ]);
  });

  it("metadata가 있으면 구체 예시, 없으면 중립 예시를 만든다", () => {
    expect(exampleParamsText([sido])).toBe('{"sidoName":"서울"}');
    expect(exampleParamsText([])).toBe('{"region": "seoul"}');
    expect(exampleParamsText(undefined)).toBe('{"region": "seoul"}');
  });
});
