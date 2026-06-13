import "server-only";

import { createHash } from "node:crypto";
import type { AdminWriteToolId } from "@/lib/llm/tools/types";
import { prisma } from "@/lib/db";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashCanonicalPayload(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export async function createWriteConfirmation(params: {
  userId: string;
  toolId: AdminWriteToolId;
  input: unknown;
  ttlMs: number;
  nowMs?: number;
}): Promise<{ token: string; expiresAtMs: number }> {
  const nowMs = params.nowMs ?? Date.now();
  const expiresAtMs = nowMs + params.ttlMs;
  const token = crypto.randomUUID();
  const payloadHash = hashCanonicalPayload(params.input);
  await prisma.adminWriteToolConfirmation.create({
    data: {
      token,
      userId: params.userId,
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
  userId: string;
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
      userId: true,
      toolId: true,
      payloadHash: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!record) return { ok: false, reason: "not_found" };
  if (record.userId !== params.userId) return { ok: false, reason: "mismatch" };
  if (record.toolId !== params.toolId) return { ok: false, reason: "mismatch" };
  if (record.usedAt !== null) return { ok: false, reason: "used" };
  if (nowMs > record.expiresAt.getTime()) return { ok: false, reason: "expired" };
  if (record.payloadHash !== hashCanonicalPayload(params.input)) {
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
