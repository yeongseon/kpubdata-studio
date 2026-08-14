/**
 * LLM 원본 출력에서 구조화 응답을 추출/검증한다 (#256).
 *
 * 4중 게이트의 1단계(zod 파싱)만 담당한다. "모양"은 맞지만 "내용"(실존 dataset/run 등)이
 * 맞는지는 `crossCheck.ts`가 담당한다.
 */
import { kubiStructuredResponseSchema } from "./schema";
import type { KubiStructuredResponse } from "./types";

export type ParseKubiResponseResult =
  | { ok: true; response: KubiStructuredResponse }
  | { ok: false; message: string };

/**
 * LLM 원본 텍스트에서 ```json 블록(또는 텍스트 전체)을 추출해 zod로 검증한다.
 *
 * @param rawOutput - provider.stream()이 반환한 누적 텍스트.
 * @returns 검증된 구조화 응답 또는 사람이 읽을 수 있는 실패 사유.
 */
export function parseKubiResponse(rawOutput: string): ParseKubiResponseResult {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return { ok: false, message: "LLM이 빈 응답을 반환했습니다." };
  }

  const jsonMatch = trimmed.match(/```json\s*\n([\s\S]*?)\n```/) ?? trimmed.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : trimmed;

  let candidate: unknown;
  try {
    candidate = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: "LLM 응답을 JSON으로 해석할 수 없습니다." };
  }

  const result = kubiStructuredResponseSchema.safeParse(candidate);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return { ok: false, message: `LLM 응답 형식이 예상과 다릅니다: ${issues}` };
  }

  return {
    ok: true,
    response: {
      answer: result.data.answer,
      evidenceRefs: result.data.evidenceRefs,
      generatedSql: result.data.generatedSql,
      suggestedActions: result.data.suggestedActions,
    },
  };
}
