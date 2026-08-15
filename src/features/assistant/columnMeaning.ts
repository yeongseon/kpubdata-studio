/**
 * 컬럼 의미 해독 — dataset card 보강 (AI-1, #228).
 *
 * 한국 공공데이터 컬럼명(MTHDT, BSNS_LCNS_NO, OPNSFTEAM_CODE 등)의 한국어
 * 설명 초안을 LLM으로 생성한다. 샘플 값은 structured content로 공통 provider
 * egress에 전달되어 직렬화 전에 스크러빙된다. 승인 전에는 metadata에 반영되지 않는다.
 */
import type { AssistProvider, AssistMessage } from "./provider";

/** 컬럼 설명 초안 결과. */
export interface ColumnMeaningResult {
  descriptions: Record<string, string>;
  status: "ok" | "error";
  scrubbed: boolean;
}

/** 컬럼 메타데이터 (PreviewColumn 의 부분집합). */
export interface ColumnMeta {
  name: string;
  dtype: string;
}

/**
 * 컬럼 목록과 샘플 행에서 LLM 프롬프트를 구성한다 (#228).
 *
 * 샘플 행은 문자열로 미리 직렬화하지 않고 structured content로 유지한다.
 * 공통 provider egress가 key-aware 스크러빙한 뒤 최종 payload를 만든다.
 */
export function buildColumnMeaningPrompt(
  columns: ColumnMeta[],
  sampleRows: Record<string, unknown>[],
): { messages: AssistMessage[] } {
  const colList = columns
    .map((c) => `  - ${c.name} (${c.dtype})`)
    .join("\n");

  const systemPrompt = `당신은 한국 공공데이터 컬럼명 해독 전문가입니다.
각 컬럼의 이름, dtype, 샘플 값을 근거로 한국어 설명을 작성하세요.
출력 형식: JSON 객체, 키는 컬럼명, 값은 한국어 설명 (1~2문장).
시크릿 값은 마스킹되어 있으니 그대로 두세요.`;

  const userPrompt = `컬럼 목록:
${colList}

샘플 데이터는 첨부된 구조화 컨텍스트를 참고하세요.

각 컬럼에 대한 한국어 설명을 JSON으로 출력하세요.`;

  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt, structuredContent: sampleRows.slice(0, 5) },
    ],
  };
}

/**
 * 컬럼 설명 초안을 LLM 으로 생성한다 (#228).
 *
 * @param provider LLM provider (BYOK).
 * @param columns 컬럼 메타데이터.
 * @param sampleRows 샘플 행 (공통 provider egress에서 스크러빙 후 LLM 전송).
 * @param signal 취소 신호.
 * @returns 컬럼명 → 한국어 설명 매핑. LLM 미설정 시 status="error".
 */
export async function generateColumnMeanings(
  provider: AssistProvider,
  columns: ColumnMeta[],
  sampleRows: Record<string, unknown>[],
  signal?: AbortSignal,
): Promise<ColumnMeaningResult> {
  const { messages } = buildColumnMeaningPrompt(columns, sampleRows);

  const exchange = provider.exchange(messages, signal);
  let rawOutput = "";
  for await (const chunk of exchange.displayOutput) {
    rawOutput += chunk;
  }

  // JSON 추출 (```json 블록 또는 직접 JSON).
  const jsonMatch =
    rawOutput.match(/```json\n([\s\S]*?)\n```/) ?? rawOutput.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : rawOutput.trim();

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, string>;
    return { descriptions: parsed, status: "ok", scrubbed: exchange.hadSecrets };
  } catch {
    return { descriptions: {}, status: "error", scrubbed: exchange.hadSecrets };
  }
}
