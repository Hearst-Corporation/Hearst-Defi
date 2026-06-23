/**
 * Human-message contract for the Master Agent write/send tool flow.
 * Pure functions — no LLM, no DB, no send.
 */
import { describe, it, expect } from "vitest";

import {
  beforeConfirmationMessage,
  writeErrorMessage,
  invalidInputMessage,
} from "@/lib/llm/tools/tool-messages";

describe("beforeConfirmationMessage", () => {
  it("draft tools say nothing is sent/published yet", () => {
    expect(beforeConfirmationMessage("outreach_draft_email").body).toMatch(/never sent|not.*sent|review/i);
    expect(beforeConfirmationMessage("create_review_note_draft").body).toMatch(/nothing is published|until you confirm/i);
    expect(beforeConfirmationMessage("create_governance_proposal_draft").body).toMatch(/not executed|no on-chain|until you confirm/i);
  });

  it("send run mentions the autonomy governance + SUGGEST sends nothing", () => {
    const m = beforeConfirmationMessage("outreach_trigger_send_run");
    expect(m.body).toMatch(/SUGGEST.*no email|Outreach Autonomy/i);
    expect(m.body).toMatch(/Tier A is never auto-sent/i);
    expect(m.body).toMatch(/confirm/i);
  });

  it("sourcing says no credit spent until confirmed", () => {
    expect(beforeConfirmationMessage("outreach_source_leads").body).toMatch(/no credit is spent|nothing is emailed/i);
  });

  it("unknown tool falls back to a safe generic confirm message", () => {
    const m = beforeConfirmationMessage("future_tool");
    expect(m.body).toMatch(/explicit confirmation|Nothing has happened yet/i);
  });
});

describe("writeErrorMessage", () => {
  it("maps confirmation reasons to human, actionable copy (never the raw code only)", () => {
    expect(writeErrorMessage("x", "admin_write_confirmation_expired")).toMatchObject({
      title: expect.stringMatching(/expired/i),
      code: "expired",
    });
    expect(writeErrorMessage("x", "admin_write_confirmation_used").body).toMatch(/already used/i);
    expect(writeErrorMessage("x", "admin_write_confirmation_mismatch").body).toMatch(/changed|start it again/i);
    expect(writeErrorMessage("x", "admin_write_confirmation_not_found").body).toMatch(/fresh one|start the action/i);
  });

  it("maps not-allowed to a clear no-change message", () => {
    const m = writeErrorMessage("x", "admin_write_tool_not_allowed");
    expect(m.body).toMatch(/no change was made|not available/i);
  });

  it("turns a raw ZodError / invalid_* into a tool-specific human reason (no leak)", () => {
    const zodish = writeErrorMessage(
      "outreach_source_leads",
      'too_small: expected number to be >0 at path ["count"]',
    );
    expect(zodish.body).toMatch(/positive number of leads/i);
    expect(zodish.body).not.toMatch(/zod|too_small|path/i);

    expect(writeErrorMessage("outreach_draft_email", "invalid_outreach_draft_email_input").body).toMatch(
      /valid prospect/i,
    );
  });

  it("unknown error is a safe generic 'nothing sent' message", () => {
    const m = writeErrorMessage("x", "kaboom internal stack trace");
    expect(m.body).toMatch(/nothing was sent or changed/i);
    expect(m.body).not.toMatch(/stack|kaboom/i);
  });
});

describe("invalidInputMessage", () => {
  it("is tool-specific", () => {
    expect(invalidInputMessage("outreach_source_leads").body).toMatch(/number of leads/i);
    expect(invalidInputMessage("outreach_draft_email").body).toMatch(/prospect/i);
    expect(invalidInputMessage("create_review_note_draft").body).toMatch(/title and body/i);
    expect(invalidInputMessage("anything_else").body).toMatch(/required details/i);
  });
});
