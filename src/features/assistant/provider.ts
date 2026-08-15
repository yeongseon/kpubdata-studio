/**
 * BuildSpec 어시스턴트 — LLM 호출 추상화 (#205, ST-A2).
 *
 * Studio는 정적 SPA라 서버가 없다. v1은 BYOK(Bring Your Own Key)로
 * 사용자가 Settings에서 자기 API 키를 입력하고 브라우저가 LLM API를 직접 호출한다.
 *
 * **공용 키를 VITE_*로 주입하는 것은 절대 금지** — 번들에 평문으로 박힌다.
 */
import { createSecretScrubber, type SecretScrubber } from "./scrub";

export interface AssistMessage {
  role: "system" | "user" | "assistant";
  content: string;
  structuredContent?: unknown;
}

export interface AssistExchange {
  readonly output: AsyncIterable<string>;
  readonly displayOutput: AsyncIterable<string>;
  readonly hadSecrets: boolean;
  restoreText(text: string): string;
}

const SAFE_PROVIDER: unique symbol = Symbol("safe-assist-provider");

export interface AssistProvider {
  readonly [SAFE_PROVIDER]: true;
  exchange(messages: AssistMessage[], signal?: AbortSignal): AssistExchange;
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

interface AssistTransport {
  stream(messages: AssistMessage[], signal?: AbortSignal): AsyncIterable<string>;
  readonly isConfigured: boolean;
}

class ByokTransport implements AssistTransport {
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

function prepareMessages(messages: AssistMessage[], scrubber: SecretScrubber): AssistMessage[] {
  return messages.map(({ role, content, structuredContent }) => {
    const safeText = scrubber.scrubText(content);
    if (structuredContent === undefined) return { role, content: safeText };
    const safeStructured = scrubber.scrub(structuredContent);
    return { role, content: `${safeText}\n${JSON.stringify(safeStructured, null, 2)}` };
  });
}

const PLACEHOLDER_PREFIX = "__SCRUBBED_";
const COMPLETE_PLACEHOLDER = /^__SCRUBBED_[A-Za-z0-9-]+_\d+__/;

async function* redactDisplayOutput(output: AsyncIterable<string>): AsyncIterable<string> {
  let pending = "";
  for await (const chunk of output) {
    pending += chunk;
    while (pending) {
      const marker = pending.indexOf(PLACEHOLDER_PREFIX);
      if (marker < 0) {
        const safeLength = Math.max(0, pending.length - (PLACEHOLDER_PREFIX.length - 1));
        if (safeLength > 0) {
          yield pending.slice(0, safeLength);
          pending = pending.slice(safeLength);
        }
        break;
      }
      if (marker > 0) {
        yield pending.slice(0, marker);
        pending = pending.slice(marker);
      }
      const placeholder = pending.match(COMPLETE_PLACEHOLDER)?.[0];
      if (!placeholder) break;
      yield "[REDACTED]";
      pending = pending.slice(placeholder.length);
    }
  }

  if (pending.startsWith(PLACEHOLDER_PREFIX)) {
    yield pending.replace(/^__SCRUBBED_\S*/, "[REDACTED]");
  } else if (pending) {
    yield pending;
  }
}

class SafeAssistProvider implements AssistProvider {
  readonly [SAFE_PROVIDER] = true;

  constructor(private transport: AssistTransport) {}

  get isConfigured(): boolean {
    return this.transport.isConfigured;
  }

  exchange(messages: AssistMessage[], signal?: AbortSignal): AssistExchange {
    const scrubber = createSecretScrubber();
    const safeMessages = prepareMessages(messages, scrubber);
    const output = this.transport.stream(safeMessages, signal);
    return {
      output,
      displayOutput: redactDisplayOutput(output),
      hadSecrets: scrubber.placeholders.size > 0,
      restoreText: (text) => scrubber.restoreText(text),
    };
  }

  async *stream(messages: AssistMessage[], signal?: AbortSignal): AsyncIterable<string> {
    yield* this.exchange(messages, signal).displayOutput;
  }
}

export function createProvider(config: AssistConfig): AssistProvider {
  return new SafeAssistProvider(
    new ByokTransport({
      ...config,
      model: config.model || DEFAULT_MODEL,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    }),
  );
}
