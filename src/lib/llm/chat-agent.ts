import "server-only";

import { chatOutputViolation, guardChatStream } from "@/lib/llm/output-guard";
import {
  navigateTool,
  resolveNavDestination,
  type NavDestination,
} from "@/lib/llm/navigate-tool";

/**
 * App-side, tool-capable streaming chat engine for the LP Master Agent.
 *
 * Why this exists: the @hearst/cockpit-shell handler streams plain text with NO
 * tool support, so it cannot expose the `navigate` tool. Rather than fork the
 * shared package, the conversational path runs through this app-owned engine,
 * which calls OpenAI with the single `navigate` tool, streams the guarded text
 * answer to the client (same text/plain contract the cockpit-shell client
 * expects), and surfaces the chosen navigation destination out-of-band.
 *
 * Safety:
 * - The user-facing stream is wrapped by `guardChatStream` (forbidden words /
 *   single-point APY), exactly like the buffered path.
 * - `nav` resolves to a destination ONLY when the model picked a whitelisted
 *   key AND the full answer is compliant — we never navigate off the back of a
 *   blocked / non-compliant answer.
 */

// Minimal structural client type — avoids hard-coupling to a specific `openai`
// version and lets tests inject a fake. The real `kimi` OpenAI instance
// satisfies this shape (its streamed `create` returns an AsyncIterable).
interface ToolCallDelta {
  index?: number;
  function?: { name?: string; arguments?: string };
}
interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: ToolCallDelta[] };
  }>;
}
export interface StreamingChatClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          stream: true;
          messages: Array<{ role: string; content: string }>;
          tools?: unknown[];
          tool_choice?: "auto" | "none";
        },
        options?: { signal?: AbortSignal },
      ): Promise<AsyncIterable<StreamChunk>>;
    };
  };
}

export interface ChatAgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatAgentResult {
  /** Guarded text stream (text/plain) to return to the client. */
  stream: ReadableStream<Uint8Array>;
  /**
   * Resolves AFTER the model turn completes with the navigation destination the
   * model chose (whitelisted + compliant answer), or null. Never rejects.
   */
  nav: Promise<NavDestination | null>;
}

/** Picks the first valid `navigate` destination from accumulated tool calls. */
function destinationFromToolCalls(
  toolCalls: Map<number, { name: string; args: string }>,
): NavDestination | null {
  for (const { name, args } of toolCalls.values()) {
    if (name !== "navigate") continue;
    try {
      const parsed = JSON.parse(args) as { destination?: string };
      const dest = resolveNavDestination(parsed.destination);
      if (dest) return dest;
    } catch {
      // malformed arguments JSON — ignore this call
    }
  }
  return null;
}

/**
 * Runs one Master Agent turn. Returns the guarded text stream and a promise for
 * the navigation destination.
 */
export function runChatAgent(
  client: StreamingChatClient,
  model: string,
  messages: ChatAgentMessage[],
  options?: { signal?: AbortSignal },
): ChatAgentResult {
  const enc = new TextEncoder();

  let resolveNav: (d: NavDestination | null) => void = () => {};
  const nav = new Promise<NavDestination | null>((r) => {
    resolveNav = r;
  });
  let navSettled = false;
  const finishNav = (d: NavDestination | null): void => {
    if (navSettled) return;
    navSettled = true;
    resolveNav(d);
  };

  const raw = new ReadableStream<Uint8Array>({
    async start(controller) {
      let consumerGone = false;
      const safeEnqueue = (s: string): void => {
        if (consumerGone || s.length === 0) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          consumerGone = true; // downstream guard terminated / client aborted
        }
      };

      let completion: AsyncIterable<StreamChunk>;
      try {
        completion = await client.chat.completions.create(
          {
            model,
            stream: true,
            messages,
            tools: [navigateTool],
            tool_choice: "auto",
          },
          options?.signal ? { signal: options.signal } : undefined,
        );
      } catch (err) {
        safeEnqueue(
          `\x00ERROR:${err instanceof Error ? err.message : "LLM error"}`,
        );
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        finishNav(null);
        return;
      }

      let fullText = "";
      const toolCalls = new Map<number, { name: string; args: string }>();

      try {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            fullText += delta.content;
            safeEnqueue(delta.content);
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const cur = toolCalls.get(idx) ?? { name: "", args: "" };
              if (tc.function?.name) cur.name = tc.function.name;
              if (tc.function?.arguments) cur.args += tc.function.arguments;
              toolCalls.set(idx, cur);
            }
          }
        }
      } catch (err) {
        safeEnqueue(
          `\x00ERROR:${err instanceof Error ? err.message : "LLM error"}`,
        );
      }

      try {
        controller.close();
      } catch {
        /* already closed */
      }

      // Navigate only when the model picked a whitelisted destination AND the
      // answer is compliant — never off the back of a blocked answer.
      let dest = destinationFromToolCalls(toolCalls);
      if (dest && chatOutputViolation(fullText, true)) {
        dest = null;
      }
      finishNav(dest);
    },

    cancel() {
      finishNav(null);
    },
  });

  return { stream: guardChatStream(raw), nav };
}
