import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import { isChatMode, type ChatMode } from "@/lib/llm/chat-modes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODE_RATE_MAX = 30;
const MODE_RATE_WINDOW_MS = 60_000;

async function requireAdminUser(): Promise<string> {
  const auth = await requireAdmin();
  return auth.userId;
}

function adminError(err: unknown): NextResponse<{ error: string }> {
  const message = err instanceof Error ? err.message : "Admin access required";
  const isAuthRequired = message.toLowerCase().includes("authentication required");
  return NextResponse.json(
    { error: message },
    { status: isAuthRequired ? 401 : 403 },
  );
}

async function rateLimit(userId: string, action: "read" | "write"): Promise<void> {
  await assertRateLimit(
    `admin-chat-mode:${action}:${userId}`,
    MODE_RATE_MAX,
    MODE_RATE_WINDOW_MS,
  );
}

export async function GET(): Promise<NextResponse<{ mode: ChatMode } | { error: string }>> {
  let userId: string;
  try {
    userId = await requireAdminUser();
  } catch (err) {
    return adminError(err);
  }

  try {
    await rateLimit(userId, "read");
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const row = await prisma.adminChatMode.findUnique({
      where: { userId },
      select: { mode: true },
    });
    const mode = isChatMode(row?.mode) ? row.mode : "normal";
    return NextResponse.json({ mode });
  } catch (err) {
    logger.error(
      "admin chat mode lookup failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Unable to read chat mode" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ mode: ChatMode } | { error: string }>> {
  let userId: string;
  try {
    userId = await requireAdminUser();
  } catch (err) {
    return adminError(err);
  }

  try {
    await assertBodySize(request);
    await rateLimit(userId, "write");
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = typeof raw === "object" && raw !== null ? (raw as { mode?: unknown }).mode : null;
  if (!isChatMode(mode)) {
    return NextResponse.json({ error: "Invalid chat mode" }, { status: 400 });
  }

  try {
    await prisma.adminChatMode.upsert({
      where: { userId },
      update: { mode },
      create: { userId, mode },
    });
    return NextResponse.json({ mode });
  } catch (err) {
    logger.error(
      "admin chat mode upsert failed",
      { userId, mode },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Unable to save chat mode" }, { status: 500 });
  }
}
