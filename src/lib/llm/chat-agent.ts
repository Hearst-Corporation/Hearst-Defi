import "server-only";

import { chatOutputViolation, guardChatStream } from "@/lib/llm/output-guard";
import {
  type NavProfile,
} from "@/lib/llm/navigate-tool";
import { projectAdminReadResultForExternal } from "@/lib/llm/tools/redaction";
import { getAllowedAdminReadTools, executeAdminReadTool } from "@/lib/llm/tools/registry";
import { ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";
import { nextOrAbort, createSafeEnqueue } from "@/lib/llm/stream-utils";
import { logger } from "@/lib/logger";

/**
 * App-side, tool-capable streaming chat engine for the LP Master Agent.
 *
 * Navigation is 100% deterministic: the route resolves the destination via a
 * closed regex whitelist (resolveNavFallbackDestinationKey) BEFORE the LLM turn.
 * The model exposes NO navigate tool — navigation never depends on model output.
 *
 * Safety:
 * - The user-facing stream is wrapped by `guardChatStream` (forbidden words /
 *   single-point APY), exactly like the buffered path.
 * - Admin read tools are the only tools exposed to the model; write tools are
 *   always human-in-the-loop and never auto-executed.
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
/** Token usage reported by the provider on the final streaming chunk (only
 *  emitted when `stream_options.include_usage` is requested). */
export interface ChatTurnUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: ToolCallDelta[] };
  }>;
  /** Present only on the terminal usage chunk (choices is then empty). */
  usage?: ChatTurnUsage | null;
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
          /** Ask the provider to emit a terminal usage chunk so token counts
           *  can be traced without a second (non-streaming) call. */
          stream_options?: { include_usage: boolean };
        },
        options?: { signal?: AbortSignal },
      ): Promise<AsyncIterable<StreamChunk>>;
    };
  };
}

/** Outcome of a single model turn, independent of compliance. `timeout` is the
 *  internal turn budget firing; `failed` is any other upstream/stream error. */
export type ChatTurnStatus = "success" | "failed" | "timeout";

/** Result surfaced by the `final` promise. Carries the real turn outcome so the
 *  caller can persist an honest LlmRun (no hard-coded "success"). Never rejects. */
export interface ChatTurnFinal {
  text: string;
  blocked: boolean;
  status: ChatTurnStatus;
  /** Short, non-sensitive code for failed/timeout turns; null otherwise. */
  errorType: string | null;
  /** Token usage when the provider reported it; null when unavailable. */
  usage: ChatTurnUsage | null;
  /** Always null — navigation is now deterministic (regex router) and never
   *  proposed by the model. Kept for backwards compatibility with callers that
   *  read this field (persistNavTrace, tests). */
  navProposedKey: null;
  /** Always false — no model-proposed navigation means nothing to block. */
  navBlocked: false;
}

export interface ChatAgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatAgentResult {
  /** Guarded text stream (text/plain) to return to the client. */
  stream: ReadableStream<Uint8Array>;
  /**
   * Resolves AFTER the turn with the final answer text (for persistence),
   * whether it was compliance-blocked, and the real turn telemetry (status,
   * usage). When `blocked` is true the caller MUST NOT persist `text` (it
   * never reached the user either). Never rejects.
   */
  final: Promise<ChatTurnFinal>;
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
  usage: ChatTurnUsage | null;
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


/** Generic FR error surfaced to the user on an upstream/LLM failure. The
 *  cockpit-shell client shows the text after `\x00ERROR:` verbatim, so this must
 *  never carry the raw provider error (which can leak model ids / quota detail /
 *  internal hostnames). The real error stays in server logs. */
const LLM_ERROR_MESSAGE =
  "\x00ERROR:Le service est momentanément indisponible — réessayez dans un instant.";

const ADMIN_WRITE_TOOL_ID_SET = new Set<string>(ADMIN_WRITE_TOOL_IDS);

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
  let usage: ChatTurnUsage | null = null;
  const toolCallsByIndex = new Map<number, AggregatedToolCall>();
  const iterator = completion[Symbol.asyncIterator]();

  for (;;) {
    const { done, value } = await nextOrAbort(iterator, signal);
    if (done) break;
    // The terminal usage chunk (stream_options.include_usage) carries `usage`
    // and an empty `choices` array — capture it before the delta short-circuit.
    if (value.usage) usage = value.usage;
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

  return { text, usage, toolCalls: mapToolCalls(toolCallsByIndex) };
}

/**
 * Defensively normalize model-supplied tool-call arguments to a plain object.
 *
 * The `arguments` string is produced by the model, so it can be malformed JSON
 * or a non-object (array / primitive). Each tool's own Zod schema validates the
 * shape, but those schemas expect an object — so anything that is not a JSON
 * object collapses to `{}` here, giving every tool a predictable input type
 * instead of a surprise. This is a thin defensive layer in front of the
 * per-tool `safeParse`, not a replacement for it (contre-audit P1-001 → P2).
 */
function parseToolArgsObject(raw: string): Record<string, unknown> {
  if (raw.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    logger.warn("chat-agent: tool call arguments malformed JSON — collapsed to {}", {
      rawLen: raw.length,
    });
  }
  return {};
}

async function executeAdminReadCalls(
  toolCalls: AggregatedToolCall[],
  userId?: string,
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
      const parsedInput = parseToolArgsObject(toolCall.args);
      try {
        const result = await executeAdminReadTool(readTool, context, parsedInput, {
          userId,
        });
        const projectedResult = projectAdminReadResultForExternal(result);
        const payloadLine = projectedResult.payload
          ? [`JSON_PAYLOAD`, JSON.stringify(projectedResult.payload)]
          : [];
        readRuns.push({
          toolCallId: toolCall.id,
          toolId: readTool.id,
          content: [projectedResult.title, ...projectedResult.lines, ...payloadLine].join("\n"),
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
            `TOOL UNAVAILABLE (${readTool.id})`,
            "This read tool could not return data this time (no data was changed).",
            "Tell the operator the data is temporarily unavailable and offer to retry or proceed without it — do NOT invent values.",
          ].join("\n"),
        });
      }
      continue;
    }

    if (ADMIN_WRITE_TOOL_ID_SET.has(calledName)) {
      blockedWriteCalls.push({ toolCallId: toolCall.id, toolId: calledName });
      logger.warn("chat-agent: blocked model write tool auto-exec attempt", {
        toolId: calledName,
        ...(userId ? { userId } : {}),
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

/**
 * Human-in-the-loop guidance for a write/send tool the model tried to auto-run.
 *
 * The Master Agent may never auto-execute a write/send (ADR-012 / ADR-017): the
 * actual execution is the operator's, via the confirmation-token flow on the
 * action panel. But "BLOCKED / disabled" reads to the model as an error and
 * produces a dead-end answer. Instead we tell the model this is the EXPECTED
 * mandate behaviour and how to respond: describe what the action would do and
 * invite the operator to confirm it — without claiming it was done.
 *
 * The phrasing is tailored to the action's nature so the resulting answer is
 * accurate: a *draft* tool never sends, a *send* run is governed by the autonomy
 * dial, sourcing spends no credit until confirmed.
 */
export function writeToolGuidance(toolId: string): string {
  switch (toolId) {
    case "outreach_draft_email":
    case "create_review_note_draft":
    case "create_governance_proposal_draft":
      return [
        "This is a DRAFT-only action and nothing is sent or executed.",
        "Confirm it on the action panel to create the draft.",
        "Tell the operator what the draft will contain and that it stays in review until they approve it — do NOT claim it was created yet.",
      ].join(" ");
    case "outreach_trigger_send_run":
      return [
        "This would start a governed outreach send run (autonomy dial: SUGGEST sends nothing; Tier A is never auto-sent; suppression + forbidden-words are re-checked).",
        "Confirm it on the action panel to run it.",
        "Tell the operator exactly what would be sent and that it needs their explicit confirmation — do NOT claim anything was sent.",
      ].join(" ");
    case "outreach_source_leads":
      return [
        "This would source new leads against the active ICP; it sends nothing and spends no credit until confirmed.",
        "Confirm it on the action panel to run sourcing.",
        "Tell the operator what will be sourced and invite them to confirm — do NOT claim leads were sourced yet.",
      ].join(" ");
    default:
      return [
        "This is a write action that needs the operator's explicit confirmation on the action panel before it runs.",
        "Describe what it would do and invite them to confirm — do NOT claim it was done.",
      ].join(" ");
  }
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
        `ACTION NEEDS CONFIRMATION (${blockedCall.toolId})`,
        "Not auto-executed — this is expected, not an error.",
        writeToolGuidance(blockedCall.toolId),
      ].join("\n"),
    });
  }

  return toolMessages;
}

/**
 * Runs one Master Agent turn. Returns the guarded text stream and a final
 * promise for persistence metadata. Navigation is resolved deterministically
 * by the route (regex router) — the model exposes NO navigate tool.
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
    userId?: string;
    /** Accepted but IGNORED: navigation is now always deterministic (regex).
     *  Kept in the API so callers do not need updating. */
    exposeNavigate?: boolean;
  },
): ChatAgentResult {
  const enc = new TextEncoder();
  const navProfile = options?.navProfile ?? "lp";
  // Suppress unused-variable warnings: navProfile is kept so the parameter
  // is still accepted (backwards compat) even though the navigate tool is gone.
  void navProfile;

  // Combine the optional caller signal with an internal timeout so the model
  // turn can never hang unboundedly (B1). Whichever fires first aborts the turn.
  const timeoutMs = options?.timeoutMs ?? DEFAULT_CHAT_TURN_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  let resolveFinal: (r: ChatTurnFinal) => void = () => {};
  const final = new Promise<ChatTurnFinal>((r) => {
    resolveFinal = r;
  });
  let finalSettled = false;
  const finishFinal = (r: ChatTurnFinal): void => {
    if (finalSettled) return;
    finalSettled = true;
    resolveFinal(r);
  };
  /** Builds the `final` payload for an aborted/errored turn (no usable answer).
   *  `timeout` is distinguished from a generic failure so monitoring can tell
   *  the internal turn budget apart from upstream errors. */
  const finishFailed = (errorType: string): void => {
    finishFinal({
      text: "",
      blocked: false,
      status: timeoutSignal.aborted ? "timeout" : "failed",
      errorType,
      usage: null,
      navProposedKey: null,
      navBlocked: false,
    });
  };

  const raw = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = createSafeEnqueue(controller, enc);

      let completion: AsyncIterable<StreamChunk>;
      try {
        const isAdminMode = options?.chatMode === "admin";
        const adminReadTools = isAdminMode
          ? getAllowedAdminReadTools({
              chatMode: "admin",
              profile: "admin",
            })
          : [];
        // Navigation is now 100% deterministic (regex router in the route).
        // The model exposes NO navigate tool — only admin read tools remain.
        const declaredTools: unknown[] = [
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
            stream_options: { include_usage: true },
          },
          { signal },
        );

        let firstPass: ConsumeResult;
        // Stream the first pass directly even in admin mode. The previous
        // behaviour held all first-pass text (enqueueText: () => {}) until both
        // rounds finished — so an admin waited for TWO full gpt-4.1 rounds before
        // seeing a single word, even on a plain question with no tool call (the
        // common case). Streaming live: a no-tool answer appears immediately; a
        // tool-call first pass emits ~no text anyway, so nothing visible is
        // discarded when the second pass replaces it.
        let firstPassStreamedText = false;
        const firstPassEnqueue = (chunk: string): void => {
          firstPassStreamedText = true;
          safeEnqueue(chunk);
        };
        try {
          firstPass = await consumeCompletion({
            completion,
            signal,
            enqueueText: firstPassEnqueue,
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
          finishFailed("llm_stream");
          return;
        }

        let effectiveText = firstPass.text;
        let effectiveUsage = firstPass.usage;

        if (isAdminMode) {
          const { readRuns, blockedWriteCalls } = await executeAdminReadCalls(
            firstPass.toolCalls,
            options?.userId,
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
                  stream_options: { include_usage: true },
                },
                { signal },
              );
              // If the first pass already streamed visible text (rare for a
              // tool-call pass, but possible), suppress the second pass's text so
              // the bubble doesn't show both. The first-pass text stays as the
              // answer; the second pass still resolves usage/tool-calls. When the
              // first pass was silent (the normal tool-call case), stream live.
              const secondPass = await consumeCompletion({
                completion: completion2,
                signal,
                enqueueText: firstPassStreamedText ? () => {} : safeEnqueue,
              });
              if (!firstPassStreamedText) {
                effectiveText = secondPass.text;
              }
              effectiveUsage = secondPass.usage ?? effectiveUsage;
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
              finishFailed("admin_second_pass");
              return;
            }
          }
          // No `else` re-emit needed: when there is no second pass, the first
          // pass already streamed its text live above.
        }

        const blocked = chatOutputViolation(effectiveText, true) !== null;

        try {
          controller.close();
        } catch {
          /* already closed */
        }

        // Persist only a compliant answer — a blocked one never reached the user.
        finishFinal({
          text: blocked ? "" : effectiveText,
          blocked,
          status: "success",
          errorType: null,
          usage: effectiveUsage,
          navProposedKey: null,
          navBlocked: false,
        });
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
        finishFailed("llm_create");
        return;
      }

    },

    cancel() {
      // Consumer (client) went away mid-stream — not an upstream error, but the
      // turn did not complete. Mark it distinctly so monitoring isn't polluted.
      finishFinal({
        text: "",
        blocked: false,
        status: "failed",
        errorType: "client_cancelled",
        usage: null,
        navProposedKey: null,
        navBlocked: false,
      });
    },
  });

  return { stream: guardChatStream(raw), final };
}
