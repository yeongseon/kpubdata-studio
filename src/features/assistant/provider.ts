/**
 * BuildSpec 어시스턴트 — LLM 호출 추상화 (#205, ST-A2).
 *
 * Studio는 정적 SPA라 서버가 없다. v1은 BYOK(Bring Your Own Key)로
 * 사용자가 Settings에서 자기 API 키를 입력하고 브라우저가 LLM API를 직접 호출한다.
 *
 * **공용 키를 VITE_*로 주입하는 것은 절대 금지** — 번들에 평문으로 박힌다.
 */

export interface AssistMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AssistProvider {
  stream(messages: AssistMessage[], signal?: AbortSignal): AsyncIterable<string>;
  readonly isConfigured: boolean;
}

export interface AssistConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export class ByokProvider implements AssistProvider {
  constructor(private config: AssistConfig) {}

  get isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }

  async *stream(messages: AssistMessage[], signal?: AbortSignal): AsyncIterable<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          // SSE 파싱 오류는 무시 — 일부 청크는 불완전할 수 있음
        }
      }
    }
  }
}

export function createProvider(config: AssistConfig): AssistProvider {
  return new ByokProvider({
    ...config,
    model: config.model || DEFAULT_MODEL,
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
  });
}
