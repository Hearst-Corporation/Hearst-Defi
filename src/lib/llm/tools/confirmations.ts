import "server-only";

import type { AdminWriteToolId } from "@/lib/llm/tools/types";
import { prisma } from "@/lib/db";

function hashPayload(value: unknown): string {
  return JSON.stringify(value);
}

export async function createWriteConfirmation(params: {
  toolId: AdminWriteToolId;
  input: unknown;
  ttlMs: number;
  nowMs?: number;
}): Promise<{ token: string; expiresAtMs: number }> {
  const nowMs = params.nowMs ?? Date.now();
  const expiresAtMs = nowMs + params.ttlMs;
  const token = crypto.randomUUID();
  const payloadHash = hashPayload(params.input);
  await prisma.adminWriteToolConfirmation.create({
    data: {
      token,
      toolId: params.toolId,
      payloadHash,
      expiresAt: new Date(expiresAtMs),
      usedAt: null,
    },
  });
  return { token, expiresAtMs };
}

type ConsumeResultReason = "not_found" | "expired" | "used" | "mismatch";

export async function consumeWriteConfirmation(params: {
  token: string;
  toolId: AdminWriteToolId;
  input: unknown;
  nowMs?: number;
}): Promise<{ ok: true } | { ok: false; reason: ConsumeResultReason }> {
  const nowMs = params.nowMs ?? Date.now();
  const record = await prisma.adminWriteToolConfirmation.findUnique({
    where: { token: params.token },
    select: {
      token: true,
      toolId: true,
      payloadHash: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!record) return { ok: false, reason: "not_found" };
  if (record.toolId !== params.toolId) return { ok: false, reason: "mismatch" };
  if (record.usedAt !== null) return { ok: false, reason: "used" };
  if (nowMs > record.expiresAt.getTime()) return { ok: false, reason: "expired" };
  if (record.payloadHash !== hashPayload(params.input)) {
    return { ok: false, reason: "mismatch" };
  }
  const usedAt = new Date(nowMs);
  const markUsed = await prisma.adminWriteToolConfirmation.updateMany({
    where: {
      token: params.token,
      usedAt: null,
    },
    data: { usedAt },
  });
  if (markUsed.count !== 1) {
    return { ok: false, reason: "used" };
  }
  return { ok: true };
}

export async function clearWriteConfirmationsForTests(): Promise<void> {
  await prisma.adminWriteToolConfirmation.deleteMany();
}

export async function pruneExpiredWriteConfirmations(nowMs?: number): Promise<number> {
  const now = new Date(nowMs ?? Date.now());
  const deleted = await prisma.adminWriteToolConfirmation.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { not: null } },
      ],
    },
  });
  return deleted.count;
}
