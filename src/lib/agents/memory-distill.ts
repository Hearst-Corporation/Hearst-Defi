import "server-only";

import { prisma } from "@/lib/db";
import { callLlm } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";
import {
  writeMemoryFacts,
  MEMORY_KINDS,
  type AgentMemory,
  type MemoryFactInput,
  type MemoryKind,
  MAX_FACT_LEN,
} from "@/lib/agents/memory";
import { tryParseLlmJsonObject } from "@/lib/agents/parse-llm-json";

/**
 * Auto-distillation of cockpit conversations into durable AgentMemory facts.
 *
 * Cost note (ADR-011, OpenAI GPT-4.1): this issues ONE OpenAI call per
 * invocation. The cockpit chat route fires it after an exchange so the agent's
 * memory "upgrades" from what the customer discussed — billed to OpenAI, not
 * Anthropic. Failures are swallowed (best-effort): a chat must never break
 * because memory distillation failed.
 */

const DISTILL_SYSTEM = [
  "You are a memory extractor for an institutional DeFi assistant.",
  "From a conversation, extract ONLY DURABLE and useful facts about the user,",
  "which will help the assistant in future sessions: preferences, goals, constraints,",
  "profile (segment, jurisdiction, language), tickets/amounts mentioned, vault of interest.",
  "STRICT rules:",
  "- Invent NOTHING. If the conversation contains no durable fact, return an empty list.",
  "- Ignore smalltalk, one-off questions, ephemeral elements.",
  "- Each fact: one short, factual sentence, ≤ 200 characters, in English.",
  "- NEVER use the words: guarantee, promise, guaranteed, certain return, risk-free.",
  "- Do not memorize any secret, key, password, or authentication data.",
  'Answer STRICTLY in JSON: {"facts":[{"kind":"fact|preference|goal|constraint","content":"..."}]}.',
  "No text outside the JSON.",
].join("\n");

const MAX_MESSAGES = 30;
const MAX_FACTS = 8;

interface DistilledFact {
  kind?: string;
  content?: unknown;
}


/** Parses the facts array from a distillation response; returns [] on any failure. */
function parseFacts(raw: string): MemoryFactInput[] {
  const parsed = tryParseLlmJsonObject(raw);
  if (parsed === null) return [];

  const arr =
    parsed && typeof parsed === "object" && "facts" in parsed
      ? (parsed as { facts: unknown }).facts
      : parsed;

  if (!Array.isArray(arr)) return [];

  const out: MemoryFactInput[] = [];
  for (const item of arr.slice(0, MAX_FACTS)) {
    if (item === null || typeof item !== "object") continue;
    const { kind, content } = item as DistilledFact;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (trimmed.length < 3) continue;
    const safeKind: MemoryKind = MEMORY_KINDS.has(String(kind))
      ? (kind as MemoryKind)
      : "fact";
    out.push({ kind: safeKind, content: trimmed.slice(0, MAX_FACT_LEN) });
  }
  return out;
}

/**
 * Reads the recent messages of a chat, asks the LLM to distil durable facts,
 * and writes them to AgentMemory. Best-effort: returns the created AgentMemory
 * rows, or an empty array on any failure (never throws).
 */
export async function distillChatToMemory(opts: {
  userId: string;
  chatId: string;
  agentName?: string;
}): Promise<AgentMemory[]> {
  const agentName = opts.agentName ?? "cockpit-chat";

  try {
    const messages = await prisma.cockpitMessage.findMany({
      where: { chatId: opts.chatId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "asc" },
      take: MAX_MESSAGES,
      select: { role: true, content: true },
    });

    if (messages.length === 0) return [];

    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const { response } = await callLlm("memory-distill", {
      model: LLM_MODEL,
      max_tokens: 600,
      system: DISTILL_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Conversation to analyze (extract only durable facts):\n\n" +
            transcript,
        },
      ],
    });

    const text = response.content.map((b) => b.text).join("");
    const facts = parseFacts(text);
    if (facts.length === 0) return [];

    return writeMemoryFacts({
      userId: opts.userId,
      agentName,
      source: "chat-distill",
      sourceChatId: opts.chatId,
      facts,
    });
  } catch {
    // Best-effort: distillation must never surface to the chat caller.
    return [];
  }
}
