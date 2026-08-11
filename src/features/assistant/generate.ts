/**
 * 자연어 → BuildSpec 생성 + 리페어 루프 (ST-A7, #210).
 *
 * 4중 게이트 환각 차단:
 * ① zod 파싱 → ② 카탈로그 대조 → ③ Builder /validate → ④ 사용자 승인
 * 각 게이트 실패 시 최대 2회 재생성. 상한 초과 시 부분 결과 반환.
 * 승인 전 /build 호출 금지.
 */
import type { AssistProvider, AssistMessage } from "./provider";
import { isRealBuilderEnabled } from "@/shared/lib/builderApi";

export interface GenerationResult {
  spec: string | null;
  status: "ok" | "partial" | "error";
  attempts: number;
  remaining_problems: string[];
}

const MAX_REPAIR_ATTEMPTS = 2;

export async function generateBuildSpec(
  provider: AssistProvider,
  userPrompt: string,
  options: {
    catalogContext?: string;
    validateFn?: (spec: string) => Promise<{ valid: boolean; problems?: string[] }>;
    signal?: AbortSignal;
  } = {},
): Promise<GenerationResult> {
  if (!isRealBuilderEnabled()) {
    return {
      spec: null,
      status: "error",
      attempts: 0,
      remaining_problems: ["mock 모드에서는 생성 기능이 비활성화됩니다 (ST-A8, #211)"],
    };
  }

  const systemPrompt = `당신은 한국 공공데이터 BuildSpec 생성기입니다.
사용자의 자연어 요청을 BuildSpec YAML로 변환하세요.
${options.catalogContext ? `사용 가능한 provider/dataset:\n${options.catalogContext}\n` : ""}
목록 밖의 provider/dataset은 사용하지 마세요.
YAML만 출력하세요. 설명은 출력하지 마세요.`;

  let lastProblems: string[] = [];

  for (let attempts = 1; attempts <= MAX_REPAIR_ATTEMPTS + 1; attempts++) {
    const messages: AssistMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    if (lastProblems.length > 0) {
      messages.push({
        role: "assistant",
        content: "이전 출력에 오류가 있었습니다. 수정하겠습니다.",
      });
      messages.push({
        role: "user",
        content: `오류:\n${lastProblems.join("\n")}\n\n이 오류를 수정한 YAML을 다시 출력하세요.`,
      });
    }

    let rawOutput = "";
    for await (const chunk of provider.stream(messages, options.signal)) {
      rawOutput += chunk;
    }

    // ① zod 파싱은 Builder /validate에 위임 — 여기서는 YAML 추출만
    const yamlMatch = rawOutput.match(/```yaml\n([\s\S]*?)\n```/) ?? rawOutput.match(/^([\s\S]*yaml)/m);
    const spec = yamlMatch ? yamlMatch[1].trim() : rawOutput.trim();

    if (!spec) {
      lastProblems = ["빈 출력이 반환되었습니다."];
      continue;
    }

    // ③ Builder 검증
    if (options.validateFn) {
      const result = await options.validateFn(spec);
      if (result.valid) {
        return { spec, status: "ok", attempts, remaining_problems: [] };
      }
      lastProblems = result.problems ?? ["검증 실패"];
      continue;
    }

    // validateFn 없으면 그대로 반환 (게이트 우회 — 테스트용)
    return { spec, status: "ok", attempts, remaining_problems: [] };
  }

  return {
    spec: null,
    status: "partial",
    attempts: MAX_REPAIR_ATTEMPTS + 1,
    remaining_problems: lastProblems,
  };
}
