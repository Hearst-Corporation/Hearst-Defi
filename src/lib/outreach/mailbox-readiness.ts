import "server-only";

import { env } from "@/lib/env";
import { autonomyAtLeast, type Autonomy } from "@/lib/outreach/send-policy";
import type { ReadinessRule } from "@/lib/outreach/autonomy-status";

/**
 * Mailbox readiness — read-only, PURE derivation of "what would actually happen
 * if a send fired right now", framed for a future connected-mailbox integration.
 *
 * There is NO mailbox provider integration today: outbound goes through Resend
 * (see src/lib/email/send.ts) and there is no `MailboxConnection` table. This
 * module makes that state HONEST in the UI — "draft-only" / "via Resend, no
 * personal mailbox" / "not connected" — and gives a future Gmail/IMAP
 * integration a single seam to plug into (create a connection → this helper
 * reports it → senders route through it), WITHOUT any schema change now.
 *
 * Mirrors the `autonomy-status.ts` pattern: reads `env` + the same pure policy
 * functions the senders use, touches no DB, and never returns a secret (the
 * Resend key is reduced to a boolean presence flag).
 */

/** Providers a future mailbox connection could use. Resend is the implicit today. */
export type MailboxProvider = "resend" | "gmail" | "imap";

/**
 * FUTURE contract for a connected mailbox. NOT persisted yet — no Prisma model
 * exists. Defined here so a later integration has a stable shape to target and
 * the UI can be typed against it ahead of time. `getMailboxReadiness()` returns
 * `connection: null` until such a model + integration lands.
 */
export interface MailboxConnection {
  provider: MailboxProvider;
  accountEmail: string;
  status: "pending" | "connected" | "disabled" | "error";
  lastSyncAt: string | null;
  /** The address sends are issued as (may differ from accountEmail). */
  sendAs: string | null;
  inboundSyncEnabled: boolean;
  outboundSendEnabled: boolean;
  replyTrackingEnabled: boolean;
}

/** What will actually carry a send right now. */
export type SendProvider = "mailbox" | "resend" | "none";

export interface MailboxReadiness {
  /** Could a real send fire at all right now (provider present AND autonomy ≥ SEND)? */
  isReady: boolean;
  /** The transport a send would use: a connected mailbox, Resend fallback, or nothing. */
  sendProvider: SendProvider;
  /** A real personal mailbox connected? Always false until the integration lands. */
  connected: boolean;
  /** The connected mailbox, or null when none (always null today). */
  connection: MailboxConnection | null;
  /** True when nothing can send — the system can only draft. */
  draftOnly: boolean;
  /** Current autonomy ceiling. */
  autonomy: Autonomy;
  /** Resend delivery key present (boolean only — secret never returned). */
  resendConfigured: boolean;
  /** Whether inbound replies are being synced from a mailbox (false today; Resend webhook is separate). */
  inboundSyncActive: boolean;
  /** Honest one-line posture for the UI. */
  statusLabel: string;
  /** Readiness checklist rules (same shape as the autonomy panel). */
  rules: ReadinessRule[];
}

function isResendConfigured(): boolean {
  return (
    typeof process.env.RESEND_API_KEY === "string" &&
    process.env.RESEND_API_KEY.trim().length > 0
  );
}

/**
 * Derive the current mailbox/sending readiness. No I/O, no send, no secret leak.
 *
 * Today: no `MailboxConnection` exists, so `connected` is always false and
 * `sendProvider` is "resend" when the Resend key is set, otherwise "none".
 * A future integration flips `connected`/`connection` and `sendProvider` to
 * "mailbox" without any caller change.
 */
export function getMailboxReadiness(): MailboxReadiness {
  const autonomy = env.OUTREACH_AUTONOMY as Autonomy;
  const resendConfigured = isResendConfigured();

  // No mailbox model yet → never connected. Resend is the only transport.
  const connected = false;
  const connection: MailboxConnection | null = null;

  const sendProvider: SendProvider = connected
    ? "mailbox"
    : resendConfigured
      ? "resend"
      : "none";

  // A send can only fire when a transport exists AND autonomy is at least SEND.
  // (Per-tier/budget/suppression guards still apply downstream — this is the
  // coarse "is sending even possible" gate.)
  const canSend = sendProvider !== "none" && autonomyAtLeast(autonomy, "SEND");
  const isReady = canSend;
  const draftOnly = !canSend;

  const statusLabel = buildStatusLabel({
    autonomy,
    sendProvider,
    connected,
  });

  const rules: ReadinessRule[] = [
    {
      label: "Connected mailbox",
      ok: connected,
      detail: connected
        ? "A personal mailbox is connected; sends and inbound sync run through it."
        : "No personal mailbox is connected. Sends use Resend (if configured) or stay draft-only; inbound replies arrive via the Resend webhook.",
    },
    {
      label: "Delivery transport",
      ok: sendProvider !== "none",
      detail:
        sendProvider === "mailbox"
          ? "Connected mailbox."
          : sendProvider === "resend"
            ? "Resend is configured — real delivery is possible when autonomy allows it."
            : "No transport configured — nothing can be sent (fail-closed). Drafts are still safe.",
    },
    {
      label: "Autonomy gate",
      ok: autonomyAtLeast(autonomy, "SEND"),
      detail:
        autonomy === "SUGGEST"
          ? "SUGGEST — draft-only; no email auto-sends regardless of transport."
          : `${autonomy} — autonomous sending is permitted for eligible prospects, within all other guards.`,
    },
    {
      label: "Inbound reply sync",
      ok: true,
      detail: connected
        ? "Replies sync from the connected mailbox."
        : "Inbound replies are captured via the Resend inbound webhook (no mailbox polling yet).",
    },
  ];

  return {
    isReady,
    sendProvider,
    connected,
    connection,
    draftOnly,
    autonomy,
    resendConfigured,
    inboundSyncActive: connected,
    statusLabel,
    rules,
  };
}

function buildStatusLabel(args: {
  autonomy: Autonomy;
  sendProvider: SendProvider;
  connected: boolean;
}): string {
  const { autonomy, sendProvider, connected } = args;
  if (connected) {
    return "Connected mailbox — sends and inbound sync are live.";
  }
  if (autonomy === "SUGGEST") {
    return "Draft-only — autonomy is SUGGEST; no email auto-sends. No mailbox connected.";
  }
  if (sendProvider === "none") {
    return "Draft-only — no delivery transport configured (fail-closed). No mailbox connected.";
  }
  return "Sending via Resend — no personal mailbox connected; inbound replies via webhook.";
}
