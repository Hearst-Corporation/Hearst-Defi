/**
 * Human-readable messaging for the Master Agent's admin write/send tool flow.
 *
 * Pure, no I/O — safe to import on the server route and (string-only output) to
 * surface in the chat UI. The execution machinery (confirmation tokens, autonomy
 * dial, telemetry) is unchanged; this module only turns its states and error
 * codes into something an operator can read, so the Master never leaves the user
 * at a raw `ZodError` / `admin_write_confirmation_mismatch` / bare token.
 *
 * Doctrine: execute under mandate, confirm only what is risky, refuse clearly,
 * stay fluid. So the BEFORE-confirmation copy says what will happen and what
 * will NOT happen yet; the AFTER copy reports the real outcome; errors are a
 * human reason plus a short technical code only when it helps.
 */

import type { AdminWriteToolId } from "@/lib/llm/tools/types";

export interface ToolMessage {
  /** Short human title. */
  title: string;
  /** One or two human sentences. */
  body: string;
  /** Optional short technical code (kept for operators/devs, never a stack). */
  code?: string;
}

/** Per-tool nature → what to say before the operator confirms. */
const BEFORE_CONFIRM: Record<AdminWriteToolId, ToolMessage> = {
  create_review_note_draft: {
    title: "Prepare review note (draft)",
    body: "I can prepare this review note as a draft. Nothing is published until you confirm.",
  },
  create_governance_proposal_draft: {
    title: "Prepare governance proposal (draft)",
    body: "I can prepare this governance proposal as a draft in DRAFT state. It is not executed and no on-chain action happens until you confirm.",
  },
  outreach_source_leads: {
    title: "Source leads (review only)",
    body: "I can source new leads against the active ICP. They land as 'new' prospects for review — nothing is emailed and no credit is spent until you confirm.",
  },
  outreach_draft_email: {
    title: "Draft outreach email (not sent)",
    body: "I can draft this outreach email and keep it in review. It is never sent from here — confirm to create the draft.",
  },
  outreach_trigger_send_run: {
    title: "Start outreach send run",
    body: "This starts a governed send run. It is bounded by Outreach Autonomy — in SUGGEST mode no email is sent — Tier A is never auto-sent, and suppression + forbidden-words are re-checked at send time. Confirm to run it.",
  },
};

const GENERIC_BEFORE: ToolMessage = {
  title: "Confirmation needed",
  body: "This action needs your explicit confirmation before it runs. Nothing has happened yet.",
};

/**
 * Message shown when a write/send tool returns `confirmation_required` — i.e.
 * the operator is being asked to approve it. Says what will happen and what will
 * NOT happen yet.
 */
export function beforeConfirmationMessage(toolId: string): ToolMessage {
  return (BEFORE_CONFIRM as Record<string, ToolMessage>)[toolId] ?? GENERIC_BEFORE;
}

/**
 * Map a thrown write-tool error message (the stable codes the executor throws)
 * to a human reason. Unknown errors get a safe generic message — a raw
 * ZodError / stack is never surfaced.
 */
export function writeErrorMessage(toolId: string, rawMessage: string): ToolMessage {
  // Confirmation token problems (admin_write_confirmation_<reason>).
  if (rawMessage.startsWith("admin_write_confirmation_")) {
    const reason = rawMessage.replace("admin_write_confirmation_", "");
    switch (reason) {
      case "expired":
        return {
          title: "Confirmation expired",
          body: "That confirmation timed out. Ask me again and confirm within a few minutes.",
          code: reason,
        };
      case "used":
        return {
          title: "Already confirmed",
          body: "That confirmation was already used. Start the action again if you want to run it once more.",
          code: reason,
        };
      case "mismatch":
        return {
          title: "Confirmation did not match",
          body: "The action or its details changed since I asked. Start it again so I can re-confirm the exact action.",
          code: reason,
        };
      case "not_found":
        return {
          title: "Confirmation not found",
          body: "I could not find that confirmation. Start the action again to get a fresh one.",
          code: reason,
        };
      default:
        return {
          title: "Confirmation rejected",
          body: "I could not confirm that action. Start it again to retry.",
          code: reason,
        };
    }
  }

  // Not-allowed (policy / mandate).
  if (rawMessage === "admin_write_tool_not_allowed") {
    return {
      title: "Not available here",
      body: "This action is not available in the current context. No change was made.",
      code: "not_allowed",
    };
  }

  // Invalid input — both the custom `invalid_*` codes and raw validation errors
  // collapse to one clear, tool-specific human message (no ZodError leaks).
  if (rawMessage.startsWith("invalid_") || /zod|expected|too_small|too_big|required/i.test(rawMessage)) {
    return invalidInputMessage(toolId);
  }

  // Unknown — safe generic; nothing was sent.
  return {
    title: "Action could not run",
    body: "Something went wrong preparing that action and nothing was sent or changed. Try again, or rephrase what you need.",
  };
}

/** Tool-specific "I need a valid X" message for invalid input. */
export function invalidInputMessage(toolId: string): ToolMessage {
  switch (toolId) {
    case "outreach_source_leads":
      return {
        title: "How many leads?",
        body: "I need a positive number of leads to source (up to 50) before I can prepare this.",
        code: "invalid_input",
      };
    case "outreach_draft_email":
      return {
        title: "Which prospect?",
        body: "I need a valid prospect to draft for before I can prepare this email.",
        code: "invalid_input",
      };
    case "create_review_note_draft":
      return {
        title: "Note details needed",
        body: "I need a title and body for the review note before I can prepare the draft.",
        code: "invalid_input",
      };
    case "create_governance_proposal_draft":
      return {
        title: "Proposal details needed",
        body: "I need the proposal's vault, action type, justification and signer count before I can prepare the draft.",
        code: "invalid_input",
      };
    default:
      return {
        title: "Missing details",
        body: "Some required details are missing or invalid. Tell me the specifics and I'll prepare it.",
        code: "invalid_input",
      };
  }
}
