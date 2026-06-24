import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { stripCanvasOpenMarker } from "@/lib/canvas/intent";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cockpit-chats/[id] — load a single conversation's messages.
 *
 * Consumed by `@hearst/cockpit-shell`'s useChat hook on chatId change.
 * Returns `{ messages: [{ id, role, content, created_at }] }` (snake_case
 * `created_at` is the shape the client deserialises). A miss (wrong owner
 * or unknown id) returns 404 to avoid leaking existence — the client falls
 * back to a welcome message in that case.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await assertRateLimit(`cockpit-chats:get:${userId}`, 60, 60_000);

  const chat = await prisma.cockpitChat.findUnique({
    where: { id },
    select: { userId: true, title: true },
  });
  if (!chat || chat.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rows = await prisma.cockpitMessage.findMany({
    where: { chatId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
    take: 200,
  });

  return NextResponse.json({
    id,
    title: chat.title,
    messages: rows
      .filter((r) => r.role === "user" || r.role === "assistant")
      .map((r) => ({
        id: r.id,
        role: r.role,
        // Strip the hidden canvas open-marker before display. It is appended to
        // the PERSISTED assistant turn (cockpit-chat/route.ts) purely so the next
        // turn's cross-turn detection (detectActiveCanvasFromHistory, which reads
        // its own DB load) knows the workshop is still on screen — it must never
        // reach the chat bubble. Without this strip the literal "[[canvas-open:…]]"
        // leaked into the rendered transcript on reload/reconciliation.
        content:
          r.role === "assistant" ? stripCanvasOpenMarker(r.content) : r.content,
        created_at: r.createdAt.toISOString(),
      })),
  });
}

/**
 * DELETE /api/cockpit-chats/[id] — delete a single conversation.
 *
 * Consumed by `@hearst/cockpit-shell`'s ChatHistory (per-row trash button).
 * Isolation: the delete is scoped to `{ id, userId }`, so a user can never
 * delete someone else's conversation even by guessing an id. A miss (wrong
 * owner or unknown id) returns 404, not 403, to avoid leaking existence.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await assertRateLimit(`cockpit-chats:delete:${userId}`, 20, 60_000);

  // Scope the delete to the owner — cascade removes the chat's messages.
  const { count } = await prisma.cockpitChat.deleteMany({
    where: { id, userId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  logger.info("cockpit chat deleted", { userId, chatId: id });
  return NextResponse.json({ ok: true });
}
