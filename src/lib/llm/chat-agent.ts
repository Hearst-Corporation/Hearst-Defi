import "server-only";

import { chatOutputViolation, guardChatStream } from "@/lib/llm/output-guard";
import {
  createNavigateTool,
  resolveNavDestinationForProfile,
  type NavProfile,
  type NavDestination,
} from "@/lib/llm/navigate-tool";
import { getAllowedAdminReadTools, executeAdminReadTool } from "@/lib/llm/tools/registry";
import { ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";
import { logger } from "@/lib/logger";

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
// version and lets tests inject a fake. The real OpenAI instance
// (`@/lib/llm/openai`) satisfies this shape (its streamed `create` returns an
// AsyncIterable).
interface ToolCallDelta {
  index?: number;
  id?: string;
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
          messages: unknown[];
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

interface AggregatedToolCall {
  id: string;
  name: string;
  args: string;
}

interface AdminReadToolRun {
  toolCallId: string;
  toolId: string;
  content: string;
}

interface ConsumeResult {
  text: string;
  toolCalls: AggregatedToolCall[];
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

/** Generic FR error surfaced to the user on an upstream/LLM failure. The
 *  cockpit-shell client shows the text after `\x00ERROR:` verbatim, so this must
 *  never carry the raw provider error (which can leak model ids / quota detail /
 *  internal hostnames). The real error stays in server logs. */
const LLM_ERROR_MESSAGE =
  "\x00ERROR:Le service est momentanément indisponible — réessayez dans un instant.";

const ADMIN_WRITE_TOOL_ID_SET = new Set<string>(ADMIN_WRITE_TOOL_IDS);

/** Picks the first valid `navigate` destination from accumulated tool calls. */
function destinationFromToolCalls(
  toolCalls: AggregatedToolCall[],
  navProfile: NavProfile,
): NavDestination | null {
  for (const { name, args } of toolCalls) {
    if (name !== "navigate") continue;
    try {
      const parsed = JSON.parse(args) as { destination?: string };
      const dest = resolveNavDestinationForProfile(parsed.destination, navProfile);
      if (dest) return dest;
    } catch {
      // malformed arguments JSON — ignore this call
    }
  }
  return null;
}

function mapToolCalls(toolCallsByIndex: Map<number, AggregatedToolCall>): AggregatedToolCall[] {
  return [...toolCallsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);
}

async function consumeCompletion(params: {
  completion: AsyncIterable<StreamChunk>;
  signal: AbortSignal;
  enqueueText: (text: string) => void;
}): Promise<ConsumeResult> {
  const { completion, signal, enqueueText } = params;
  let text = "";
  const toolCallsByIndex = new Map<number, AggregatedToolCall>();
  const iterator = completion[Symbol.asyncIterator]();

  for (;;) {
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason ?? new Error("aborted"));
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason ?? new Error("aborted")), {
        once: true,
      });
    });
    abortPromise.catch(() => {});

    const { done, value } = await Promise.race([iterator.next(), abortPromise]);
    if (done) break;
    const delta = value.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      text += delta.content;
      enqueueText(delta.content);
    }

    if (!delta.tool_calls) continue;
    for (const tc of delta.tool_calls) {
      const idx = tc.index ?? 0;
      const cur = toolCallsByIndex.get(idx) ?? {
        id: tc.id ?? `call_${idx}`,
        name: "",
        args: "",
      };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name = tc.function.name;
      if (tc.function?.arguments) cur.args += tc.function.arguments;
      toolCallsByIndex.set(idx, cur);
    }
  }

  return { text, toolCalls: mapToolCalls(toolCallsByIndex) };
}

async function executeAdminReadCalls(
  toolCalls: AggregatedToolCall[],
): Promise<{
  readRuns: AdminReadToolRun[];
  blockedWriteCalls: Array<{ toolCallId: string; toolId: string }>;
}> {
  const context = { chatMode: "admin" as const, profile: "admin" as const };
  const allowedReadTools = getAllowedAdminReadTools(context);
  const readToolById = new Map<string, (typeof allowedReadTools)[number]>(
    allowedReadTools.map((tool) => [tool.id, tool]),
  );
  const readRuns: AdminReadToolRun[] = [];
  const blockedWriteCalls: Array<{ toolCallId: string; toolId: string }> = [];

  for (const toolCall of toolCalls) {
    const calledName = toolCall.name.trim();
    if (!calledName || calledName === "navigate") continue;

    const readTool = readToolById.get(calledName);
    if (readTool) {
      let parsedInput: unknown = undefined;
      if (toolCall.args.trim().length > 0) {
        try {
          parsedInput = JSON.parse(toolCall.args);
        } catch {
          parsedInput = {};
        }
      }
      try {
        const result = await executeAdminReadTool(readTool, context, parsedInput);
        const payloadLine = result.payload
          ? [`JSON_PAYLOAD`, JSON.stringify(result.payload)]
          : [];
        readRuns.push({
          toolCallId: toolCall.id,
          toolId: readTool.id,
          content: [result.title, ...result.lines, ...payloadLine].join("\n"),
        });
      } catch (error) {
        logger.warn(
          "chat-agent: admin read tool call failed",
          { toolId: readTool.id },
          error instanceof Error ? error : undefined,
        );
        readRuns.push({
          toolCallId: toolCall.id,
          toolId: readTool.id,
          content: [
            `TOOL ERROR (${readTool.id})`,
            "unavailable: read tool execution failed",
          ].join("\n"),
        });
      }
      continue;
    }

    if (ADMIN_WRITE_TOOL_ID_SET.has(calledName)) {
      blockedWriteCalls.push({ toolCallId: toolCall.id, toolId: calledName });
      logger.warn("chat-agent: blocked model write tool auto-exec attempt", {
        toolId: calledName,
      });
    }
  }

  return { readRuns, blockedWriteCalls };
}

function toAssistantToolMessage(toolCalls: AggregatedToolCall[]): Record<string, unknown> {
  return {
    role: "assistant",
    content: "",
    tool_calls: toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: toolCall.args,
      },
    })),
  };
}

function toToolResultMessages(
  readRuns: AdminReadToolRun[],
  blockedWriteCalls: Array<{ toolCallId: string; toolId: string }>,
): Array<Record<string, unknown>> {
  const toolMessages: Array<Record<string, unknown>> = readRuns.map((run) => ({
    role: "tool",
    tool_call_id: run.toolCallId,
    content: run.content,
  }));

  for (const blockedCall of blockedWriteCalls) {
    toolMessages.push({
      role: "tool",
      tool_call_id: blockedCall.toolCallId,
      content: [
        `WRITE TOOL BLOCKED (${blockedCall.toolId})`,
        "automatic execution disabled",
        "return only a structured proposal (no side effects)",
      ].join("\n"),
    });
  }

  return toolMessages;
}

/**
 * Runs one Master Agent turn. Returns the guarded text stream and a promise for
 * the navigation destination.
 */
export function runChatAgent(
  client: StreamingChatClient,
  model: string,
  messages: ChatAgentMessage[],
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    navProfile?: NavProfile;
    chatMode?: "normal" | "admin";
  },
): ChatAgentResult {
  const enc = new TextEncoder();
  const navProfile = options?.navProfile ?? "lp";
  const navigateTool = createNavigateTool(navProfile);

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
        const isAdminMode = options?.chatMode === "admin";
        const adminReadTools = isAdminMode
          ? getAllowedAdminReadTools({
              chatMode: "admin",
              profile: "admin",
            })
          : [];
        const declaredTools: unknown[] = [
          navigateTool,
          ...adminReadTools.map((tool) => ({
            type: "function" as const,
            function: {
              name: tool.id,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
        ];

        completion = await client.chat.completions.create(
          {
            model,
            stream: true,
            messages,
            tools: declaredTools,
            tool_choice: "auto",
          },
          { signal },
        );

        let firstPass: ConsumeResult;
        try {
          firstPass = await consumeCompletion({
            completion,
            signal,
            // In admin mode, hold first-pass text until we know if read tools were
            // requested; otherwise stream directly.
            enqueueText: isAdminMode ? () => {} : safeEnqueue,
          });
        } catch (err) {
          logger.warn(
            "chat-agent: stream iteration ended on error/abort",
            {},
            err instanceof Error ? err : undefined,
          );
          safeEnqueue(LLM_ERROR_MESSAGE);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          finishNav(null);
          finishFinal({ text: "", blocked: false });
          return;
        }

        let effectiveText = firstPass.text;
        let finalToolCalls = firstPass.toolCalls;

        if (isAdminMode) {
          const { readRuns, blockedWriteCalls } = await executeAdminReadCalls(
            firstPass.toolCalls,
          );
          const shouldSecondPass =
            readRuns.length > 0 || blockedWriteCalls.length > 0;

          if (shouldSecondPass) {
            const baseMessages: unknown[] = [...messages];
            const followupMessages: unknown[] = [
              ...baseMessages,
              toAssistantToolMessage(firstPass.toolCalls),
              ...toToolResultMessages(readRuns, blockedWriteCalls),
            ];

            try {
              const completion2 = await client.chat.completions.create(
                {
                  model,
                  stream: true,
                  messages: followupMessages,
                  tools: declaredTools,
                  tool_choice: "auto",
                },
                { signal },
              );
              const secondPass = await consumeCompletion({
                completion: completion2,
                signal,
                enqueueText: safeEnqueue,
              });
              effectiveText = secondPass.text;
              finalToolCalls = secondPass.toolCalls;
            } catch (err) {
              logger.warn(
                "chat-agent: admin second-pass stream failed",
                {},
                err instanceof Error ? err : undefined,
              );
              safeEnqueue(LLM_ERROR_MESSAGE);
              try {
                controller.close();
              } catch {
                /* already closed */
              }
              finishNav(null);
              finishFinal({ text: "", blocked: false });
              return;
            }
          } else if (effectiveText.length > 0) {
            safeEnqueue(effectiveText);
          }
        }

        // Navigate only when the model picked a whitelisted destination AND the
        // answer is compliant — never off the back of a blocked answer.
        const blocked = chatOutputViolation(effectiveText, true) !== null;
        let dest = destinationFromToolCalls(
          finalToolCalls.length > 0 ? finalToolCalls : firstPass.toolCalls,
          navProfile,
        );
        if (dest && blocked) {
          dest = null;
        }

        // B2: a tool-call-only completion produces no text. Emit a short FR
        // fallback so the bubble is never blank — but only when we actually have
        // a valid destination to send the user to, and only if the answer so far
        // is compliant (never bypass the output guard).
        let persistText = effectiveText;
        if (
          effectiveText.trim().length === 0 &&
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
        return;
      } catch (err) {
        // Never surface the raw upstream/LLM error message to the user — it can
        // leak provider internals (model ids, quota detail, internal hostnames).
        // The client shows the text after `\x00ERROR:` verbatim, so emit a
        // generic FR message and keep the detail in server logs only.
        logger.error(
          "chat-agent: LLM completion create() failed",
          {},
          err instanceof Error ? err : undefined,
        );
        safeEnqueue(LLM_ERROR_MESSAGE);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        finishNav(null);
        finishFinal({ text: "", blocked: false });
        return;
      }

    },

    cancel() {
      finishNav(null);
      finishFinal({ text: "", blocked: false });
    },
  });

  return { stream: guardChatStream(raw), nav, final };
}
