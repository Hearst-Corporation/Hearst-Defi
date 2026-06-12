import {
  createCockpitChatHandler,
  type CockpitChatHandlerConfig,
} from "@hearst/cockpit-shell/handler";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { kimi, LLM_MODEL } from "@/lib/llm/kimi";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/auth/require-auth";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  loadUserAgentProfile,
  loadUserMemory,
  buildUserContextSystemBlock,
} from "@/lib/agents/user-context";
import { sha256Hex, buildFacilitatorPrompt } from "@hearst/review-mode";
import { COCKPIT_DEFAULT_SYSTEM_PROMPT } from "@/lib/llm/prompts";
import { PRODUCT_CONTEXT } from "@/lib/product-context";

const REVIEW_FACILITATOR_PROMPT = buildFacilitatorPrompt({ productContext: PRODUCT_CONTEXT });
const REVIEW_FACILITATOR_HASH = sha256Hex(REVIEW_FACILITATOR_PROMPT);
const COCKPIT_DEFAULT_HASH = sha256Hex(COCKPIT_DEFAULT_SYSTEM_PROMPT);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Models the chat may run on. The client (cockpit-shell useChat) sends the
// value of localStorage["cockpit:chat-model"]; anything outside this allowlist
// falls back to the default so a tampered body can't pick an arbitrary model.
const ALLOWED_MODELS = new Set<string>([env.OPENAI_MODEL]);

function resolveModel(requested: string | undefined): string {
  return requested && ALLOWED_MODELS.has(requested) ? requested : LLM_MODEL;
}

// Per-user rate-limit: 20 chat requests / 60s (mirrors the handler default,
// but keyed on the authenticated userId so corporate NAT users don't share
// an IP bucket). Enforced here because we need the userId from requireAuth().
const CHAT_RATE_MAX = 20;
const CHAT_RATE_WINDOW_MS = 60_000;

// Hard caps. NOTE: the @hearst/cockpit-shell handler does NOT accept
// maxTokens/temperature (neither in CockpitChatHandlerConfig nor in its
// body schema — it builds the LLM call internally), so these are enforced
// on the inbound body to reject abusive payloads before they reach the
// handler. They cannot be forwarded to the model call itself.
const MAX_OUTPUT_TOKENS = 2048;
const MAX_CONTENT_LEN = 8_000;
const MAX_MESSAGES = 30;
// Cap on the enriched system prompt (base + user-context block).
// Must be >> the base COCKPIT_DEFAULT_SYSTEM_PROMPT length (currently ~11k
// chars / ~2.7k tokens) to leave room for the per-user context block on top.
// customInstructions is user-influenced free text — the clamp prevents a
// malicious user from inflating the system prompt arbitrarily, but must be
// generous enough that the base prompt is never silently truncated mid-rule.
const MAX_ENRICHED_SYSTEM_LEN = 16_000;

const HTML_TAG_RE = /<[^>]*>/g;

/** Strip HTML tags from untrusted user content (server-side, no DOMPurify). */
function sanitizeContent(value: string): string {
  return value.replace(HTML_TAG_RE, "").trim();
}

/**
 * Derive a short, human-readable title from a user message's content.
 * Returns null when the content yields nothing meaningful (empty / whitespace
 * after the trim/collapse), so the caller can skip the title update entirely.
 *
 * Kept inline (~6 lines) rather than abstracted: the only consumer is the
 * persistence below.
 */
const TITLE_MAX_LEN = 80;
// Minimum useful prefix before we bother cutting at a word boundary.
const TITLE_MIN_PREFIX = 40;
function deriveTitleFromContent(content: string): string | null {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length <= TITLE_MAX_LEN) return cleaned;
  // Cut at the last word boundary before the cap so we don't slice mid-word.
  const cut = cleaned.slice(0, TITLE_MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > TITLE_MIN_PREFIX ? cut.slice(0, lastSpace) : cut) + "…";
}

/**
 * Inbound body validation.
 *
 * The cockpit-shell handler's own schema accepts a client `system` field that
 * REPLACES (not appends to) the server system prompt — a guardrail-bypass on
 * an LP-facing endpoint. We deliberately DO NOT accept `system` here: the Zod
 * object strips it from the parsed body, and the sanitized body we forward
 * never carries it, so the curated server prompt (built below) always wins.
 *
 * We validate the security-relevant fields here (BEFORE the handler re-parses
 * the body) and keep the shape backwards-compatible: `message` stays required,
 * `messages` is the optional history array we constrain here for security.
 */
const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_CONTENT_LEN),
});

const ChatBodySchema = z.object({
  chatId: z.string().max(200).nullish(),
  message: z.string().min(1).max(MAX_CONTENT_LEN),
  messages: z.array(ChatMessageSchema).max(MAX_MESSAGES).optional(),
  productId: z.string().max(200).nullish(),
  // NOTE: `system` is intentionally NOT in this schema. Accepting a client
  // system prompt would let any authenticated user strip every compliance
  // guardrail (APY-as-range, forbidden words, confidentiality). Stripped here.
  // Model the client requests (from localStorage). Validated against an
  // allowlist downstream — an unknown value falls back to the default.
  model: z.string().max(100).optional(),
  // Accepted but clamped (handler ignores these; we cap defensively).
  maxTokens: z.number().int().positive().max(MAX_OUTPUT_TOKENS).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

type PersistedRole = "user" | "assistant" | "system";

interface PersistedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

/**
 * Prisma-backed chat persistence, scoped to a single authenticated user.
 *
 * The handler's `ChatPersistence` contract only passes `chatId` to load/save,
 * so userId isolation is enforced HERE by closing over the verified userId:
 *   - `createChat()` always stamps the row with this user.
 *   - `loadMessages()` only returns history if the chat belongs to this user
 *     (a foreign chatId yields an empty history — no cross-tenant leak).
 *   - `saveMessage()` no-ops if the chat is not owned by this user.
 */
function createUserScopedPersistence(
  userId: string,
  // Persona under which messages persisted via this instance were produced.
  // Resolved once per request from AdminChatMode (step 4 below) — this lets
  // the review-document generator filter on exactly the messages exchanged
  // in review sessions, instead of mixing them with normal-mode chatter.
  chatMode: "normal" | "review",
): NonNullable<CockpitChatHandlerConfig["persistence"]> {
  async function ownsChat(chatId: string): Promise<boolean> {
    const chat = await prisma.cockpitChat.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });
    return chat?.userId === userId;
  }

  return {
    async createChat(): Promise<string> {
      const chat = await prisma.cockpitChat.create({
        data: { userId },
        select: { id: true },
      });
      return chat.id;
    },

    async loadMessages(chatId: string): Promise<PersistedMessage[]> {
      if (!(await ownsChat(chatId))) {
        // Unknown or foreign chat id — treat as empty rather than leaking.
        return [];
      }
      const rows = await prisma.cockpitMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
        take: 200,
      });
      return rows
        .filter(
          (r): r is typeof r & { role: "user" | "assistant" } =>
            r.role === "user" || r.role === "assistant",
        )
        .map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          createdAt: r.createdAt.getTime(),
        }));
    },

    async saveMessage(chatId: string, msg: PersistedMessage): Promise<void> {
      if (!(await ownsChat(chatId))) {
        // Refuse to write into a chat this user does not own.
        return;
      }
      const role: PersistedRole = msg.role;
      await prisma.cockpitMessage.create({
        data: { chatId, role, content: msg.content, mode: chatMode },
      });
      // Always bump updatedAt. If this is the first user message and the chat
      // has no title yet, derive one from the content so cockpit memory
      // surfaces meaningful titles instead of "(sans titre)" for every row.
      // `updateMany` lets us add the `title: null` predicate; if no row
      // matches (title already set), it's a no-op — we then fall through to
      // the unconditional updatedAt bump.
      const derivedTitle =
        role === "user" ? deriveTitleFromContent(msg.content) : null;
      let titled = 0;
      if (derivedTitle) {
        const result = await prisma.cockpitChat.updateMany({
          where: { id: chatId, title: null },
          data: { title: derivedTitle, updatedAt: new Date() },
        });
        titled = result.count;
      }
      if (titled === 0) {
        await prisma.cockpitChat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });
      }
    },
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  // 0. Body size guard — prevent DoS via oversized payloads.
  try {
    await assertBodySize(req);
  } catch (sizeErr) {
    return new Response(
      JSON.stringify({
        error: sizeErr instanceof Error ? sizeErr.message : "Request too large",
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Auth — failure here is a 401, distinct from handler failures below.
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch (err) {
    logger.warn(
      "cockpit-chat auth rejected",
      {},
      err instanceof Error ? err : undefined,
    );
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Per-user rate-limit (defence-in-depth: the handler also rate-limits on
  //    userId, but enforcing here lets us use the shared Upstash/Redis backend
  //    so the limit holds across serverless instances).
  try {
    await assertRateLimit(
      `cockpit-chat:${userId}`,
      CHAT_RATE_MAX,
      CHAT_RATE_WINDOW_MS,
    );
  } catch {
    return new Response(
      "Trop de requêtes — réessaie dans quelques instants.",
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 3. Validate + sanitize the body BEFORE the handler re-parses it.
  //    The handler calls `req.json()` internally, so we reconstruct a
  //    fresh Request carrying the sanitized payload.
  let sanitizedReq: NextRequest;
  let requestedModel: string | undefined;
  try {
    const raw: unknown = await req.json();
    const parsed = ChatBodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = parsed.data;
    requestedModel = body.model;
    const cleanMessage = sanitizeContent(body.message);
    if (!cleanMessage) {
      return new Response(
        JSON.stringify({ error: "Message is empty after sanitization" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const sanitizedBody = {
      ...(body.chatId != null ? { chatId: body.chatId } : {}),
      message: cleanMessage,
      ...(body.messages
        ? {
            messages: body.messages.map((m) => ({
              role: m.role,
              content:
                m.role === "user" ? sanitizeContent(m.content) : m.content,
            })),
          }
        : {}),
      ...(body.productId != null ? { productId: body.productId } : {}),
      // `system` is never forwarded — the handler falls back to the curated
      // server `systemPrompt` (enrichedSystemPrompt) we pass at handler build.
    };

    sanitizedReq = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(sanitizedBody),
    }) as NextRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Resolve the base persona. An admin who flipped the chat into "review"
  //    mode (AdminChatMode row) gets the product-review facilitator prompt
  //    instead of the default assistant. Only admins can ever set this row
  //    (the setter route is requireAdmin-gated), so reading it here is safe.
  //    The resolved mode is ALSO used downstream to stamp persisted messages
  //    with their persona — `chatMode` is the source of truth for both.
  let chatMode: "normal" | "review" = "normal";
  let basePrompt = COCKPIT_DEFAULT_SYSTEM_PROMPT;
  try {
    const modeRow = await prisma.adminChatMode.findUnique({
      where: { userId },
      select: { mode: true },
    });
    if (modeRow?.mode === "review") {
      chatMode = "review";
      basePrompt = REVIEW_FACILITATOR_PROMPT;
    }
  } catch (modeErr) {
    // NOTE: si le lookup AdminChatMode échoue (DB hiccup, RLS), on dégrade en
    // mode "normal" + COCKPIT_DEFAULT_HASH. Les observabilité runs review
    // peuvent donc être sous-comptées en cas d'incidents DB. Acceptable :
    // (a) la table AdminChatMode est triviale (lecture par PK), échec rarissime,
    // (b) on préfère préserver l'UX (chat continue) qu'avoir une métrique parfaite.
    logger.warn(
      "cockpit-chat mode lookup failed — using default assistant prompt",
      { userId },
      modeErr instanceof Error ? modeErr : undefined,
    );
  }

  // 5. Build a per-request handler bound to this user (rate-limit key +
  //    persistence are both userId-scoped).
  //    Enrich the system prompt with per-user persona + memory when available.
  //    A failure here must not block the chat — graceful degradation to base prompt.
  let enrichedSystemPrompt = basePrompt;
  try {
    const [profile, memory] = await Promise.all([
      loadUserAgentProfile(userId, "cockpit-chat"),
      loadUserMemory(userId, "cockpit-chat"),
    ]);
    const ctxBlock = buildUserContextSystemBlock({ profile, memory });
    if (ctxBlock !== null) {
      // Clamp to MAX_ENRICHED_SYSTEM_LEN: customInstructions is user-influenced
      // free text and must not bloat the system prompt beyond a safe bound.
      enrichedSystemPrompt = (basePrompt + "\n\n" + ctxBlock.text).slice(
        0,
        MAX_ENRICHED_SYSTEM_LEN,
      );
    }
  } catch (ctxErr) {
    logger.warn(
      "cockpit-chat user-context enrichment failed — using base prompt",
      { userId },
      ctxErr instanceof Error ? ctxErr : undefined,
    );
  }

  const handler = createCockpitChatHandler({
    llmClient: kimi,
    model: resolveModel(requestedModel),
    systemPrompt: enrichedSystemPrompt,
    userId,
    persistence: createUserScopedPersistence(userId, chatMode),
    rateLimitMax: CHAT_RATE_MAX,
    rateLimitWindowMs: CHAT_RATE_WINDOW_MS,
  });

  // 6. Trace the call as an LlmRun. The handler streams internally and does
  //    not surface token usage or a completion hook, so we can only record
  //    wall-clock latency + terminal status here (inputTokens/outputTokens/
  //    costUsd stay null — capturing them would require forking the handler,
  //    which is out of scope and would duplicate its stream logic).
  const startedAt = Date.now();
  try {
    const res = await handler.POST(sanitizedReq);
    const latencyMs = Date.now() - startedAt;
    const ok = res.status < 400;
    try {
      await prisma.llmRun.create({
        data: {
          agentName: "cockpit-chat",
          model: LLM_MODEL,
          status: ok ? "success" : "failed",
          latencyMs,
          userId,
          // Hash of the BASE prompt only (not the enriched variant that includes
          // per-user context, which varies per request).
          systemPromptHash:
            chatMode === "review" ? REVIEW_FACILITATOR_HASH : COCKPIT_DEFAULT_HASH,
          ...(ok
            ? {}
            : {
                errorType: "handler_http_error",
                errorMessage: `handler returned ${res.status}`,
              }),
        },
      });
    } catch (traceErr) {
      // Tracing must never break the user-facing response.
      logger.warn(
        "cockpit-chat LlmRun trace failed",
        {},
        traceErr instanceof Error ? traceErr : undefined,
      );
    }
    return res;
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    logger.error(
      "cockpit-chat handler failed",
      {},
      err instanceof Error ? err : undefined,
    );
    try {
      await prisma.llmRun.create({
        data: {
          agentName: "cockpit-chat",
          model: LLM_MODEL,
          status: "failed",
          latencyMs,
          userId,
          // Hash of the BASE prompt only (not the enriched variant).
          systemPromptHash:
            chatMode === "review" ? REVIEW_FACILITATOR_HASH : COCKPIT_DEFAULT_HASH,
          errorType: err instanceof Error ? err.name : "UnknownError",
          errorMessage: err instanceof Error ? err.message : "unknown error",
        },
      });
    } catch (traceErr) {
      logger.warn(
        "cockpit-chat LlmRun trace failed",
        {},
        traceErr instanceof Error ? traceErr : undefined,
      );
    }
    return new Response(JSON.stringify({ error: "Chat handler error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
