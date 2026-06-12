export interface AdminActionConfirmationState {
  toolId: "create_review_note_draft" | "create_governance_proposal_draft";
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

export function toConfirmationRequestedState(
  state: AdminActionFlowState,
  confirmation: AdminActionConfirmationState,
): AdminActionFlowState {
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
