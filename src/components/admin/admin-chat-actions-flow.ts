import type { AdminWriteToolId } from "@/lib/llm/tools/types";
import { ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";

export interface AdminActionConfirmationState {
  toolId: AdminWriteToolId;
  token: string;
  expiresAtIso: string;
  summary: string;
  input: Record<string, unknown>;
}

export interface AdminActionFlowState {
  pendingConfirmation: AdminActionConfirmationState | null;
  actionResult: string | null;
  error: string | null;
}

const ADMIN_WRITE_TOOL_ID_SET = new Set<string>(ADMIN_WRITE_TOOL_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFutureIso(value: string): boolean {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch > Date.now();
}

export function getPendingConfirmationGuardError(
  confirmation: AdminActionConfirmationState | null,
): string | null {
  if (!confirmation) return "Aucune confirmation en attente.";
  if (!ADMIN_WRITE_TOOL_ID_SET.has(confirmation.toolId)) {
    return "Confirmation invalide (outil non reconnu).";
  }
  if (confirmation.token.trim().length === 0) {
    return "Confirmation invalide (token manquant).";
  }
  if (confirmation.summary.trim().length === 0) {
    return "Confirmation invalide (resume manquant).";
  }
  if (!isRecord(confirmation.input)) {
    return "Confirmation invalide (input manquant).";
  }
  if (!isFutureIso(confirmation.expiresAtIso)) {
    return "Confirmation expiree, redemandez une validation.";
  }
  return null;
}

export function isValidPendingConfirmation(
  confirmation: AdminActionConfirmationState | null,
): confirmation is AdminActionConfirmationState {
  return getPendingConfirmationGuardError(confirmation) === null;
}

export function toConfirmationRequestedState(
  state: AdminActionFlowState,
  confirmation: AdminActionConfirmationState,
): AdminActionFlowState {
  const guardError = getPendingConfirmationGuardError(confirmation);
  if (guardError) {
    return {
      ...state,
      pendingConfirmation: null,
      actionResult: null,
      error: guardError,
    };
  }
  return {
    ...state,
    pendingConfirmation: confirmation,
    actionResult: null,
    error: null,
  };
}

export function toExecutionSuccessState(
  state: AdminActionFlowState,
  result: string,
): AdminActionFlowState {
  return {
    ...state,
    pendingConfirmation: null,
    actionResult: result,
    error: null,
  };
}

/** The shape the chat-tools route returns on a non-executed (error) response. */
export interface AdminActionErrorResponse {
  error?: string;
  code?: string;
  message?: { title?: string; body?: string };
}

/**
 * Resolve the message to show the admin when a write action did NOT execute.
 *
 * Priority: the route's human `message.body` → its `message.title` → the plain
 * `error` string → a safe generic. The bare `code` is NEVER shown on its own —
 * it carries no meaning for an operator. Centralised so every call-site (and a
 * test) shares one contract.
 */
export function resolveActionErrorMessage(
  data: AdminActionErrorResponse | null,
): string {
  const body = data?.message?.body?.trim();
  if (body) return body;
  const title = data?.message?.title?.trim();
  if (title) return title;
  const error = data?.error?.trim();
  if (error) return error;
  return "The action could not be completed. Please try again.";
}
