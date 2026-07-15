import "server-only";

import { randomUUID } from "node:crypto";

export type CockpitMessageTraceRole = "user" | "assistant";

const TURN_ID_PREFIX = "turn_";
const TRACE_SEPARATOR = ":";

function joinTraceId(...parts: string[]): string {
  return parts.join(TRACE_SEPARATOR);
}

export function createTurnId(): string {
  return `${TURN_ID_PREFIX}${randomUUID()}`;
}

export function buildLlmRunId(turnId: string): string {
  return joinTraceId("llm", turnId);
}

export function buildNavTraceId(turnId: string): string {
  return joinTraceId("nav", turnId);
}

export function buildCockpitMessageId(
  turnId: string,
  role: CockpitMessageTraceRole,
  variant: string = "main",
): string {
  return joinTraceId("msg", turnId, role, variant);
}

export function buildAdminToolRunId(turnId: string, toolId: string): string {
  return joinTraceId("tool", turnId, toolId, randomUUID());
}
