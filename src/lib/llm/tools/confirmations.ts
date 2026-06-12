import "server-only";

import type { AdminWriteToolId } from "@/lib/llm/tools/types";

interface PendingAdminWriteConfirmation {
  token: string;
  toolId: AdminWriteToolId;
  payloadHash: string;
  expiresAtMs: number;
  usedAtMs: number | null;
}

const pendingConfirmations = new Map<string, PendingAdminWriteConfirmation>();

function confirmationsStore(): Map<string, PendingAdminWriteConfirmation> {
  return pendingConfirmations;
}

function hashPayload(value: unknown): string {
  return JSON.stringify(value);
}

export function createWriteConfirmation(params: {
  toolId: AdminWriteToolId;
  input: unknown;
  ttlMs: number;
  nowMs?: number;
}): { token: string; expiresAtMs: number } {
  const nowMs = params.nowMs ?? Date.now();
  const expiresAtMs = nowMs + params.ttlMs;
  const token = crypto.randomUUID();
  const payloadHash = hashPayload(params.input);
  confirmationsStore().set(token, {
    token,
    toolId: params.toolId,
    payloadHash,
    expiresAtMs,
    usedAtMs: null,
  });
  return { token, expiresAtMs };
}

export function consumeWriteConfirmation(params: {
  token: string;
  toolId: AdminWriteToolId;
  input: unknown;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: "not_found" | "expired" | "used" | "mismatch" } {
  const nowMs = params.nowMs ?? Date.now();
  const record = confirmationsStore().get(params.token);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.toolId !== params.toolId) return { ok: false, reason: "mismatch" };
  if (record.usedAtMs !== null) return { ok: false, reason: "used" };
  if (nowMs > record.expiresAtMs) return { ok: false, reason: "expired" };
  if (record.payloadHash !== hashPayload(params.input)) {
    return { ok: false, reason: "mismatch" };
  }
  record.usedAtMs = nowMs;
  confirmationsStore().set(params.token, record);
  return { ok: true };
}

export function clearWriteConfirmationsForTests(): void {
  confirmationsStore().clear();
}
