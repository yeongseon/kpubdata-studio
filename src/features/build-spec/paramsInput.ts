/**
 * source 파라미터를 입력하는 JSON textarea 공통 파싱 로직 (#250).
 *
 * `NewBuildPage`가 원래 로컬로 갖고 있던 `parseSourceParams`를 그대로 옮긴 것이다 —
 * Add Data Workbench의 Public API Configure 단계도 동일한 "JSON 객체" 검증/한국어
 * 오류 메시지가 필요해서, 복제하지 않고 공용 모듈로 추출했다(동작/메시지는 변경하지
 * 않았다 — 기존 New Build Wizard 테스트가 그대로 통과해야 한다).
 */

/** 파싱 결과: 성공 시 `data`, 실패 시 한국어 오류 메시지. */
export interface ParsedSourceParams {
  data?: Record<string, string>;
  error?: string;
}

/**
 * textarea의 JSON 파라미터 문자열을 `Record<string, string>`으로 정규화한다.
 *
 * @param sourceParams - 사용자가 입력한 JSON 문자열.
 * @returns 파싱된 객체 또는 한국어 오류 메시지.
 */
export function parseSourceParams(sourceParams: string): ParsedSourceParams {
  try {
    const parsed = JSON.parse(sourceParams) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "파라미터는 JSON 객체여야 합니다. 예: {\"region\": \"seoul\"}" };
    }
    const entries = Object.entries(parsed);
    const values = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
    return { data: values };
  } catch {
    return { error: "파라미터가 올바른 JSON이 아닙니다. 형식을 확인하세요." };
  }
}
