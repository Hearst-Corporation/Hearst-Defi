import "server-only";

import { env } from "@/lib/env";
import {
  decideAutoSend,
  effectiveDailyCap,
  type Autonomy,
} from "@/lib/outreach/send-policy";
import { resolveCtaUrl } from "@/lib/outreach/cta-url";
import { FORBIDDEN_WORDS } from "@/lib/agents/forbidden-words";

/**
 * Read-only derivation of the current outreach AUTONOMY posture for the admin
 * surface. Pure relative to side-effects: it reads `env` + the same pure policy
 * functions the senders use (`decideAutoSend`, `effectiveDailyCap`) and the CTA
 * resolver, so the panel can NEVER drift from what the cron/handlers actually do.
 *
 * It does NOT touch the DB and does NOT send anything. Secrets are reduced to a
 * boolean presence flag (`resendConfigured`) — the key itself never leaves the
 * server boundary or appears in the returned shape.
 */

/** One-line description per autonomy mode — kept in sync with env.ts comments. */
const MODE_DESCRIPTION: Record<Autonomy, string> = {
  SUGGEST:
    "Agent drafts only. No automatic email leaves the system — a human approves every send.",
  SEND: "First-touch sends may run automatically for eligible Tier B/C prospects, within today's budget.",
  NURTURE:
    "First-touch sends and timed follow-up sequences may run automatically for eligible Tier B/C prospects.",
  CLOSED:
    "Full closed loop: send, follow up, read replies, and qualify — all within the tier and budget guards.",
};

/** A single blocker/guard rule shown in the run-readiness list. */
export interface ReadinessRule {
  /** Short label. */
  label: string;
  /** True when this guard is currently satisfied (green); false when it would block. */
  ok: boolean;
  /** Plain-language explanation of the current state. */
  detail: string;
}

export interface OutreachAutonomyStatus {
  mode: Autonomy;
  modeDescription: string;
  /** Whether the hourly first-touch auto-sender can dispatch at this mode. */
  autoSendActive: boolean;
  /** Whether the daily follow-up cadence can dispatch at this mode. */
  followUpsActive: boolean;
  /** Tier A is never auto-sent at any mode — always true (surfaced for reassurance). */
  tierAProtected: boolean;
  /** Resend send-side key present (boolean only — the secret is never returned). */
  resendConfigured: boolean;
  /** Day-0 warm-up cap (the floor the ramp starts from). */
  warmupDayOneCap: number;
  /** Configured hard daily cap (the ceiling the ramp climbs to). */
  configuredDailyCap: number;
  /** Resolved qualification CTA URL embedded in every cold email, or null if unresolved. */
  ctaUrl: string | null;
  /** True when the CTA resolves to the production host fallback (no explicit per-env override). */
  ctaIsProdFallback: boolean;
  /** Number of forbidden-word needles enforced on every outbound string. */
  forbiddenWordCount: number;
  /** Surfaced only when mode is SEND+ AND Resend is configured — i.e. live sends possible. */
  liveSendWarning: boolean;
  /** The ordered run-readiness rules for the admin checklist. */
  rules: ReadinessRule[];
}

const PROD_APP_HOST = "https://connect.hearst.app";

/** Derives the full read-only autonomy posture. No I/O, no send, no secret leak. */
export function getOutreachAutonomyStatus(): OutreachAutonomyStatus {
  const mode = env.OUTREACH_AUTONOMY as Autonomy;

  // Use the SAME pure policy the senders use, so the panel cannot lie.
  const autoSendActive = decideAutoSend("B", mode, "first_touch").autoSend;
  const followUpsActive = decideAutoSend("B", mode, "follow_up").autoSend;
  const tierAProtected =
    !decideAutoSend("A", mode, "first_touch").autoSend &&
    !decideAutoSend("A", mode, "follow_up").autoSend;

  const configuredDailyCap = env.OUTREACH_DAILY_SEND_CAP;
  const warmupDayOneCap = effectiveDailyCap(configuredDailyCap, 0);

  const resendConfigured =
    typeof process.env.RESEND_API_KEY === "string" &&
    process.env.RESEND_API_KEY.trim().length > 0;

  const ctaUrl = resolveCtaUrl();
  const hasExplicitCta =
    !!(process.env.NEXT_PUBLIC_QUALIFICATION_FORM_URL ?? process.env.NEXT_PUBLIC_TYPEFORM_URL)?.trim();
  const hasAppUrl = !!process.env.NEXT_PUBLIC_APP_URL?.trim();
  // The CTA always resolves to something; it falls back to the PROD host only
  // when neither an explicit CTA nor an APP_URL is configured for this env.
  const ctaIsProdFallback =
    !hasExplicitCta && !hasAppUrl && ctaUrl.startsWith(PROD_APP_HOST);

  const liveSendWarning = (autoSendActive || followUpsActive) && resendConfigured;

  const rules: ReadinessRule[] = [
    {
      label: "Autonomy mode",
      ok: true,
      detail:
        mode === "SUGGEST"
          ? "SUGGEST — nothing auto-sends; every email is human-approved."
          : `${mode} — automatic sending is enabled for eligible prospects, within all guards below.`,
    },
    {
      label: "Tier A protection",
      ok: tierAProtected,
      detail: "Tier A (Prime) is never auto-sent at any mode — drafted, then a human sends.",
    },
    {
      label: "Forbidden-words guard",
      ok: forbiddenGuardCount() > 0,
      detail: `${forbiddenGuardCount()} prohibited claims are blocked on every subject and body before send.`,
    },
    {
      label: "Suppression / opt-out",
      ok: true,
      detail: "Every send re-checks the suppression list at dispatch time; opted-out addresses are skipped.",
    },
    {
      label: "Daily budget & warm-up",
      ok: warmupDayOneCap > 0,
      detail: `Auto-sends ramp from ${warmupDayOneCap}/day up to a ${configuredDailyCap}/day ceiling over the warm-up window.`,
    },
    {
      label: "Resend delivery key",
      ok: resendConfigured,
      detail: resendConfigured
        ? "Configured — real delivery is possible when the mode allows it."
        : "Not configured — no email can leave regardless of mode (fail-closed).",
    },
    {
      label: "Qualification CTA",
      ok: ctaUrl !== null && !ctaIsProdFallback,
      detail: ctaIsProdFallback
        ? `Falling back to the production host (${ctaUrl}); set NEXT_PUBLIC_APP_URL or a qualification form URL per environment.`
        : `Resolved to ${ctaUrl}.`,
    },
  ];

  return {
    mode,
    modeDescription: MODE_DESCRIPTION[mode],
    autoSendActive,
    followUpsActive,
    tierAProtected,
    resendConfigured,
    warmupDayOneCap,
    configuredDailyCap,
    ctaUrl,
    ctaIsProdFallback,
    forbiddenWordCount: forbiddenGuardCount(),
    liveSendWarning,
    rules,
  };
}

/** Count of enforced forbidden-word needles (the canonical non-negotiable #5 list). */
function forbiddenGuardCount(): number {
  return FORBIDDEN_WORDS.length;
}
