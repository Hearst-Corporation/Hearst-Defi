import "server-only";

import type { AgentMemory } from "@prisma/client";

import { prisma } from "@/lib/db";
import { containsForbidden } from "@/lib/agents/forbidden-words";

export type { AgentMemory };

/** Bound on a single stored fact — keeps the injected memory block compact. */
export const MAX_FACT_LEN = 280;

/** Cap on how many active facts are loaded into a prompt at once. */
export const MAX_INJECTED_FACTS = 12;

export type MemoryKind = "fact" | "preference" | "goal" | "constraint";
export type MemorySource = "chat-distill" | "manual";

export const MEMORY_KINDS: ReadonlySet<string> = new Set([
  "fact",
  "preference",
  "goal",
  "constraint",
]);

export interface MemoryFactInput {
  content: string;
  kind?: MemoryKind;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Returns the active durable facts for a user/agent, newest first, capped.
 * Empty array when none — never throws on missing rows.
 */
export async function loadAgentMemory(
  userId: string,
  agentName = "cockpit-chat",
  limit = MAX_INJECTED_FACTS,
): Promise<AgentMemory[]> {
  return prisma.agentMemory.findMany({
    where: { userId, agentName, active: true },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.floor(limit)),
  });
}

/** All facts (incl. inactive) for the admin memory panel of a customer. */
export async function loadAllAgentMemory(
  userId: string,
  agentName = "cockpit-chat",
): Promise<AgentMemory[]> {
  return prisma.agentMemory.findMany({
    where: { userId, agentName },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });
}

/**
 * Renders active facts as a compact text block for prompt injection. Returns
 * "" when there is nothing to surface (so callers can skip the section).
 */
export async function renderAgentMemoryBlock(
  userId: string,
  agentName = "cockpit-chat",
): Promise<string> {
  const facts = await loadAgentMemory(userId, agentName);
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- (${f.kind}) ${f.content}`);
  return `Mémoire durable (${facts.length}) :\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/** Normalises + filters a candidate fact. Returns null if unusable/forbidden. */
function sanitizeFact(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3) return null;
  const bounded = trimmed.slice(0, MAX_FACT_LEN);
  // A distilled fact that contains forbidden vocabulary is dropped silently —
  // we never let chat-derived text smuggle a forbidden claim into the prompt.
  if (containsForbidden(bounded)) return null;
  return bounded;
}

/**
 * Writes a batch of facts for a user/agent. Forbidden / empty facts are
 * dropped. Naive de-dup against existing active facts (case-insensitive exact
 * content) so re-distilling the same conversation does not pile up duplicates.
 * Returns the rows actually created.
 */
export async function writeMemoryFacts(opts: {
  userId: string;
  agentName?: string;
  source?: MemorySource;
  sourceChatId?: string | null;
  facts: MemoryFactInput[];
}): Promise<AgentMemory[]> {
  const agentName = opts.agentName ?? "cockpit-chat";
  const source = opts.source ?? "chat-distill";

  const existing = await prisma.agentMemory.findMany({
    where: { userId: opts.userId, agentName, active: true },
    select: { content: true },
  });
  const seen = new Set(existing.map((e) => e.content.toLowerCase()));

  const created: AgentMemory[] = [];
  for (const f of opts.facts) {
    const content = sanitizeFact(f.content);
    if (content === null) continue;
    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const kind: MemoryKind = MEMORY_KINDS.has(f.kind ?? "") ? (f.kind as MemoryKind) : "fact";
    const row = await prisma.agentMemory.create({
      data: {
        userId: opts.userId,
        agentName,
        kind,
        content,
        source,
        sourceChatId: opts.sourceChatId ?? null,
      },
    });
    created.push(row);
  }
  return created;
}

/** Toggle a fact active/inactive (admin curation, soft-delete). */
export async function setMemoryActive(
  id: string,
  active: boolean,
): Promise<void> {
  await prisma.agentMemory.update({ where: { id }, data: { active } });
}

/** Hard-delete a fact (admin curation). */
export async function deleteMemoryFact(id: string): Promise<void> {
  await prisma.agentMemory.delete({ where: { id } });
}
