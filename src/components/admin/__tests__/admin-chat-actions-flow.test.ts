import { describe, expect, it } from "vitest";

import {
  isValidPendingConfirmation,
  toConfirmationRequestedState,
  toExecutionSuccessState,
  type AdminActionFlowState,
} from "@/components/admin/admin-chat-actions-flow";

describe("admin chat actions confirmation flow", () => {
  it("moves to pending confirmation after step 1", () => {
    const initial: AdminActionFlowState = {
      pendingConfirmation: null,
      actionResult: "old result",
      error: "old error",
    };

    const next = toConfirmationRequestedState(initial, {
      toolId: "create_review_note_draft",
      token: "token_123",
      expiresAtIso: "2026-06-12T12:00:00.000Z",
      summary: "create_review_note_draft requires explicit confirmation",
      input: { title: "A", body: "B" },
    });

    expect(next.pendingConfirmation?.token).toBe("token_123");
    expect(next.actionResult).toBeNull();
    expect(next.error).toBeNull();
  });

  it("clears pending confirmation after successful step 2", () => {
    const initial: AdminActionFlowState = {
      pendingConfirmation: {
        toolId: "create_review_note_draft",
        token: "token_123",
        expiresAtIso: "2026-06-12T12:00:00.000Z",
        summary: "create_review_note_draft requires explicit confirmation",
        input: { title: "A", body: "B" },
      },
      actionResult: null,
      error: "temporary",
    };

    const next = toExecutionSuccessState(
      initial,
      "REVIEW NOTE DRAFT CREATED · id fb_1",
    );

    expect(next.pendingConfirmation).toBeNull();
    expect(next.actionResult).toContain("fb_1");
    expect(next.error).toBeNull();
  });

  it("rejects stale pending confirmation payload", () => {
    const initial: AdminActionFlowState = {
      pendingConfirmation: null,
      actionResult: "old result",
      error: null,
    };

    const next = toConfirmationRequestedState(initial, {
      toolId: "create_review_note_draft",
      token: "token_123",
      expiresAtIso: "2000-01-01T00:00:00.000Z",
      summary: "create_review_note_draft requires explicit confirmation",
      input: { title: "A", body: "B" },
    });

    expect(next.pendingConfirmation).toBeNull();
    expect(next.actionResult).toBeNull();
    expect(next.error).toContain("expiree");
  });

  it("accepts only future valid confirmation state", () => {
    expect(
      isValidPendingConfirmation({
        toolId: "create_review_note_draft",
        token: "token_123",
        expiresAtIso: "2100-01-01T00:00:00.000Z",
        summary: "ok",
        input: { title: "A", body: "B" },
      }),
    ).toBe(true);
    expect(
      isValidPendingConfirmation({
        toolId: "create_review_note_draft",
        token: " ",
        expiresAtIso: "2100-01-01T00:00:00.000Z",
        summary: "ok",
        input: { title: "A", body: "B" },
      }),
    ).toBe(false);
    expect(isValidPendingConfirmation(null)).toBe(false);
  });
});
