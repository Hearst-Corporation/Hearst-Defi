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
  /**
   * Resolves AFTER the turn with the final answer text (for persistence) and
   * whether it was compliance-blocked. When `blocked` is true the caller MUST
   * NOT persist `text` (it never reached the user either). Never rejects.
   */
  final: Promise<{ text: string; blocked: boolean }>;
}

/**
 * Default internal cap on a single model turn. The route awaits `nav`; if the
 * upstream stream stalls and no signal ever fires, that await would deadlock the
 * request. An internal `AbortSignal.timeout(...)` is always combined with the
 * optional caller signal so the turn can never hang unboundedly. Overridable per
 * call via `options.timeoutMs` (kept small in tests for speed).
 */
export const DEFAULT_CHAT_TURN_TIMEOUT_MS = 60_000;

/** Short FR fallback emitted when the model returns a navigate-only completion
 *  (a tool call with no text content) so the chat bubble is never blank. */
const NAV_ONLY_FALLBACK = "Je vous y emmène.";

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
  options?: { signal?: AbortSignal; timeoutMs?: number },
): ChatAgentResult {
  const enc = new TextEncoder();

  // Combine the optional caller signal with an internal timeout so the model
  // turn can never hang unboundedly (B1). Whichever fires first aborts the turn.
  const timeoutMs = options?.timeoutMs ?? DEFAULT_CHAT_TURN_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

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

  let resolveFinal: (r: { text: string; blocked: boolean }) => void = () => {};
  const final = new Promise<{ text: string; blocked: boolean }>((r) => {
    resolveFinal = r;
  });
  let finalSettled = false;
  const finishFinal = (r: { text: string; blocked: boolean }): void => {
    if (finalSettled) return;
    finalSettled = true;
    resolveFinal(r);
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
          { signal },
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
        finishFinal({ text: "", blocked: false });
        return;
      }

      let fullText = "";
      const toolCalls = new Map<number, { name: string; args: string }>();

      try {
        // Race each pull against the abort signal so a stalled upstream stream
        // (one that ignores the signal) still terminates the turn — nav must
        // always settle, the route must never deadlock (B1).
        const iterator = completion[Symbol.asyncIterator]();
        for (;;) {
          const abortPromise = new Promise<never>((_, reject) => {
            if (signal.aborted) {
              reject(signal.reason ?? new Error("aborted"));
              return;
            }
            signal.addEventListener(
              "abort",
              () => reject(signal.reason ?? new Error("aborted")),
              { once: true },
            );
          });
          // Swallow rejection if the pull wins the race — avoids an unhandled
          // rejection from the loser abortPromise.
          abortPromise.catch(() => {});

          const { done, value } = await Promise.race([
            iterator.next(),
            abortPromise,
          ]);
          if (done) break;

          const delta = value.choices?.[0]?.delta;
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

      // Navigate only when the model picked a whitelisted destination AND the
      // answer is compliant — never off the back of a blocked answer.
      const blocked = chatOutputViolation(fullText, true) !== null;
      let dest = destinationFromToolCalls(toolCalls);
      if (dest && blocked) {
        dest = null;
      }

      // B2: a tool-call-only completion produces no text. Emit a short FR
      // fallback so the bubble is never blank — but only when we actually have
      // a valid destination to send the user to, and only if the answer so far
      // is compliant (never bypass the output guard).
      let persistText = fullText;
      if (
        fullText.trim().length === 0 &&
        dest &&
        !chatOutputViolation(NAV_ONLY_FALLBACK, true)
      ) {
        safeEnqueue(NAV_ONLY_FALLBACK);
        persistText = NAV_ONLY_FALLBACK;
      }

      try {
        controller.close();
      } catch {
        /* already closed */
      }

      finishNav(dest);
      // Persist only a compliant answer — a blocked one never reached the user.
      finishFinal({ text: blocked ? "" : persistText, blocked });
    },

    cancel() {
      finishNav(null);
      finishFinal({ text: "", blocked: false });
    },
  });

  return { stream: guardChatStream(raw), nav, final };
}
