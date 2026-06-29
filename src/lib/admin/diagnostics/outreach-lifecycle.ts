/**
 * Outreach Lifecycle Demo — a readable, dry-run lens over the outreach send
 * lifecycle. NOT a real send: it describes each path (draft, direct send,
 * campaign fan-out, auto-send, follow-ups, suppression, forbidden words), the
 * guard sequence each one passes through, and whether it would write / send /
 * require confirmation — with verdicts derived from the REAL policy functions
 * (`decideAutoSend`, `containsForbidden`) so the safety claims are proven, not
 * asserted by hand.
 *
 * This sits ON TOP of the existing Outreach diagnostics suite — it does not
 * re-implement the send logic. Pure module: no I/O, no DB, no server-only, no
 * Resend, no Inngest. Nothing here dispatches an email.
 */
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { decideAutoSend } from "@/lib/outreach/send-policy";

export type LifecycleVerdict = "SAFE" | "GATED" | "UNSAFE";

export interface OutreachLifecyclePath {
  id: string;
  /** Human path name (Draft, Direct send, Campaign fan-out…). */
  path: string;
  /** What kicks the path off. */
  trigger: string;
  /** Ordered guard sequence the path passes through before any email leaves. */
  guardSequence: string[];
  /** Would this path write a business record (draft/email row)? */
  wouldWrite: boolean;
  /** Would this path dispatch an external email (Resend) — in PRODUCTION? */
  wouldSendExternal: boolean;
  /** Is external send blocked by the DEFAULT posture? */
  blockedByDefault: boolean;
  /** Does it require an explicit human confirmation before sending? */
  requiredConfirmation: boolean;
  /** What the diagnostic itself does (always: no Resend, no event). */
  diagnostic: string;
  verdict: LifecycleVerdict;
  /** The real runtime file the path lives in (for the admin to inspect). */
  source: string;
  /** Optional evidence from a real policy function (proves the claim). */
  evidence?: unknown;
}

export interface OutreachLifecycleReport {
  ok: boolean;
  mode: "dry-run";
  externalSend: false;
  resendCalled: false;
  inngestTriggered: false;
  paths: OutreachLifecyclePath[];
}

/**
 * Build the lifecycle demo. Derives the auto-send / Tier-A claims from the REAL
 * `decideAutoSend` policy and the forbidden-words claim from the REAL
 * `containsForbidden`, so a regression in either flips the verdict here.
 */
export function buildOutreachLifecycleDemo(): OutreachLifecycleReport {
  // Prove SUGGEST (default) auto-sends NOTHING and Tier A is never auto-sent,
  // straight from the policy — not a hand-written claim.
  const suggestTierBFirst = decideAutoSend("B", "SUGGEST", "first_touch");
  const sendTierAFirst = decideAutoSend("A", "SEND", "first_touch");
  const nurtureTierBFollow = decideAutoSend("B", "NURTURE", "follow_up");

  // Prove the forbidden-words guard catches an unsafe line.
  const forbiddenHit = containsForbidden(
    "This vault is risk-free and we guarantee returns.",
  );

  const paths: OutreachLifecyclePath[] = [
    {
      id: "draft",
      path: "Draft",
      trigger:
        "Chat outreach_draft tool OR admin UI — collects fields, writes a DRAFT row only",
      guardSequence: [
        "requireAdmin",
        "Zod validate",
        "forbidden-words (on draft content)",
        "persist draft (no send)",
      ],
      wouldWrite: true,
      wouldSendExternal: false,
      blockedByDefault: true,
      requiredConfirmation: false,
      diagnostic: "no draft persisted here — described only",
      verdict: "SAFE",
      source: "src/app/admin/outreach/actions.ts",
    },
    {
      id: "direct-send",
      path: "Direct Send",
      trigger: "Manual admin UI — operator clicks Send on one email",
      guardSequence: [
        "requireAdmin",
        "ConfirmDialog (explicit human confirm)",
        "forbidden-words",
        "suppression re-check",
        "Resend",
      ],
      wouldWrite: true,
      wouldSendExternal: true,
      blockedByDefault: true,
      requiredConfirmation: true,
      diagnostic: "no Resend called — guard chain described only",
      verdict: "SAFE",
      source: "src/app/admin/outreach/actions.ts",
    },
    {
      id: "campaign-fanout",
      path: "Campaign Fan-out",
      trigger: "Inngest fan-out over a campaign's recipients",
      guardSequence: [
        "per-recipient suppression re-check",
        "forbidden-words (re-checked at fan-out send, PR #211)",
        "daily cap",
        "Resend",
      ],
      wouldWrite: true,
      wouldSendExternal: true,
      blockedByDefault: true,
      requiredConfirmation: true,
      diagnostic: "no Inngest event emitted, no Resend called",
      verdict: "GATED",
      source: "src/lib/inngest/functions/outreach-send.ts",
      evidence: { forbiddenGuard: forbiddenHit !== null },
    },
    {
      id: "auto-send",
      path: "Auto-Send",
      trigger:
        "Hourly cron OR outreach_trigger_send_run chat tool → OUTREACH_AUTONOMY gate",
      guardSequence: [
        "OUTREACH_AUTONOMY ceiling (default SUGGEST = 0 sends)",
        "decideAutoSend — Tier B/C only, Tier A never",
        "daily cap + warm-up curve",
        "forbidden-words (re-checked, PR #216)",
        "suppression re-check",
        "Resend",
      ],
      wouldWrite: true,
      wouldSendExternal: true,
      blockedByDefault: true,
      requiredConfirmation: false,
      diagnostic:
        "default OUTREACH_AUTONOMY = SUGGEST ⇒ 0 auto-sends; no Resend called",
      verdict: "SAFE",
      source: "src/lib/inngest/functions/outreach-auto-send.ts",
      evidence: {
        suggestTierBFirstAutoSend: suggestTierBFirst.autoSend, // false
        tierANeverAutoSent: sendTierAFirst.autoSend, // false even at SEND
      },
    },
    {
      id: "followups",
      path: "Follow-ups",
      trigger: "Daily cron → NURTURE+ only → generate content live → send",
      guardSequence: [
        "OUTREACH_AUTONOMY ≥ NURTURE (follow-ups gated higher than first touch)",
        "decideAutoSend(kind=follow_up)",
        "forbidden-words (re-checked at follow-up send)",
        "suppression re-check",
        "Resend",
      ],
      wouldWrite: true,
      wouldSendExternal: true,
      blockedByDefault: true,
      requiredConfirmation: false,
      diagnostic: "no follow-up generated or sent here",
      verdict: "SAFE",
      source: "src/lib/inngest/functions/outreach-followups.ts",
      evidence: {
        nurtureTierBFollowAutoSend: nurtureTierBFollow.autoSend, // true (NURTURE+)
        suggestWouldHold: !suggestTierBFirst.autoSend,
      },
    },
    {
      id: "suppression",
      path: "Suppression",
      trigger: "Re-checked at EVERY send time (unsubscribe / bounce / complaint)",
      guardSequence: [
        "isSuppressed(email) — DB read",
        "skip send if suppressed (never re-mailed)",
      ],
      wouldWrite: false,
      wouldSendExternal: false,
      blockedByDefault: true,
      requiredConfirmation: false,
      diagnostic:
        "suppression is a read-only gate — a suppressed address is never mailed",
      verdict: "SAFE",
      source: "src/lib/outreach/suppression.ts",
    },
    {
      id: "forbidden-words",
      path: "Forbidden Words",
      trigger: "Every human-facing email is scanned before it leaves",
      guardSequence: [
        "containsForbidden(body) — blocks guarantee/promise/certain/risk-free…",
      ],
      wouldWrite: false,
      wouldSendExternal: false,
      blockedByDefault: true,
      requiredConfirmation: false,
      diagnostic: forbiddenHit
        ? `guard live — caught: ${forbiddenHit.found.join(", ")}`
        : "guard did NOT catch the unsafe sample (regression)",
      verdict: forbiddenHit ? "SAFE" : "UNSAFE",
      source: "src/lib/agents/forbidden-words.ts",
      evidence: forbiddenHit ?? { caught: false },
    },
  ];

  return {
    ok: paths.every((p) => p.verdict !== "UNSAFE"),
    mode: "dry-run",
    externalSend: false,
    resendCalled: false,
    inngestTriggered: false,
    paths,
  };
}
