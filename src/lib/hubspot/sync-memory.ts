import "server-only";

import type { AgentMemory } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getContactByEmail, createNote } from "@/lib/hubspot/client";

/**
 * Posts newly-distilled AgentMemory facts as a single HubSpot Note on the
 * matching contact. Best-effort — callers should catch errors.
 *
 * Idempotency: each chatId is tracked in HubSpotSync. If a note was already
 * posted for a given chatId, this call is a no-op.
 */
export async function syncMemoryToHubSpot(
  userId: string,
  facts: AgentMemory[],
): Promise<void> {
  if (facts.length === 0) return;

  const chatId = facts[0]?.sourceChatId;

  // Idempotency check: skip if this chat was already synced.
  if (chatId) {
    const already = await prisma.hubSpotSync.findFirst({
      where: { userId, kind: "note_created", sourceId: chatId },
      select: { id: true },
    });
    if (already) return;
  }

  // Resolve user email → HubSpot contact.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return;

  const contact = await getContactByEmail(user.email);
  if (!contact) return; // contact not yet synced — will be created on next qualification upsert

  const body = facts
    .map((f) => `[${f.kind}] ${f.content}`)
    .join("\n");

  const noteId = await createNote(contact.id, body);

  await prisma.hubSpotSync.create({
    data: {
      userId,
      kind: "note_created",
      hubspotObjectId: noteId,
      sourceId: chatId ?? undefined,
    },
  });
}
