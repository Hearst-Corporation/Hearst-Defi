import type { AdminWriteToolId } from "@/lib/llm/tools/types";

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

function isFutureIso(value: string): boolean {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch > Date.now();
}

export function isValidPendingConfirmation(
  confirmation: AdminActionConfirmationState | null,
): confirmation is AdminActionConfirmationState {
  if (!confirmation) return false;
  if (
    confirmation.token.trim().length === 0 ||
    confirmation.summary.trim().length === 0
  ) {
    return false;
  }
  return isFutureIso(confirmation.expiresAtIso);
}

export function toConfirmationRequestedState(
  state: AdminActionFlowState,
  confirmation: AdminActionConfirmationState,
): AdminActionFlowState {
  if (!isValidPendingConfirmation(confirmation)) {
    return {
      ...state,
      pendingConfirmation: null,
      actionResult: null,
      error: "Confirmation invalide ou expiree.",
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
