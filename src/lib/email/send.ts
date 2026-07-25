import "server-only";

import { buildEmailHtmlShell, type EmailCta } from "@/lib/email/html-shell";
import { readServerEnv } from "@/lib/env";
import { buildUnsubscribeUrl } from "@/lib/outreach/unsubscribe";

/**
 * Shared tracked-email sender.
 *
 * DRY replacement for the copy-pasted Resend `fetch` calls scattered across
 * `src/lib/auth/*` and `src/lib/inngest/functions/*`. One place to set the
 * Authorization header, the default `from`, the `reply_to`, and to forward
 * Resend `tags` so inbound delivery/open/click webhooks can be correlated back
 * to the originating record.
 *
 * Correlation strategy:
 *  - `tags` is forwarded to Resend as a `tags: [{ name, value }]` array. Resend
 *    echoes these tags on the webhook events (`email.sent`, `email.delivered`,
 *    `email.opened`, `email.clicked`, …), so a webhook handler can match on a
 *    tag like `prospect_id` or `campaign_id`.
 *  - The returned Resend email `id` is ALSO a correlation key: every webhook
 *    event carries `data.email_id`, so callers can persist the returned `id`
 *    (e.g. on `OutreachEmail`) and look events up by it.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const DEFAULT_FROM = "Hearst Connect <contact@hearst.app>";

interface SendTrackedEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  /** Forwarded to Resend as `tags: [{ name, value }]` to correlate webhooks. */
  tags?: Record<string, string>;
}

/** Shape of the relevant part of the Resend `POST /emails` success response. */
interface ResendSendResponse {
  id: string;
}

function isResendSendResponse(value: unknown): value is ResendSendResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  );
}

/**
 * Derive a `reply_to` address. An explicit `replyTo` wins. Otherwise, if the
 * resolved `from` carries an angle-bracket address (`Name <addr@host>`), reuse
 * that address so replies land back on the sending identity.
 */
function deriveReplyTo(from: string, replyTo?: string): string | undefined {
  if (replyTo && replyTo.trim().length > 0) return replyTo.trim();
  const match = from.match(/<([^>]+)>/);
  return match?.[1];
}

/**
 * Send a tracked email through Resend.
 *
 * @throws if `RESEND_API_KEY` is unset, or if Resend responds non-2xx (the
 *         thrown error includes the HTTP status and response body), or if the
 *         response is missing an `id`.
 * @returns the Resend email `id` — persist it to correlate webhook events.
 */
export async function sendTrackedEmail(
  opts: SendTrackedEmailOptions,
): Promise<{ id: string }> {
  // LIVE reads via the canon helper — unit tests set/delete the key per test.
  const apiKey = readServerEnv("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const from = opts.from ?? readServerEnv("OUTREACH_FROM") ?? DEFAULT_FROM;
  const replyTo = deriveReplyTo(from, opts.replyTo);

  const tags = opts.tags
    ? Object.entries(opts.tags).map(([name, value]) => ({ name, value }))
    : undefined;

  const body: Record<string, unknown> = {
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (replyTo) body.reply_to = replyTo;
  if (tags && tags.length > 0) body.tags = tags;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isResendSendResponse(json)) {
    throw new Error("Resend API returned a response without an email id");
  }

  return { id: json.id };
}

/**
 * Wrap plain text in the same dark email shell used by
 * `src/lib/auth/send-welcome-email.ts`, so outreach emails stay visually
 * consistent with transactional ones.
 *
 * `body` is inserted as-is into the inner paragraph — callers may pass simple
 * inline HTML (e.g. `<br/>`). Sanitize untrusted input before passing it here.
 *
 * `recipientEmail` (optional) wires a working one-click unsubscribe link into
 * the footer — REQUIRED for cold outreach (CAN-SPAM / GDPR). When omitted (e.g.
 * transactional mail that is not marketing), no unsubscribe line is rendered.
 *
 * `cta` (optional) renders a styled green button (e.g. "Apply for access" →
 * /apply) below the body — cold outreach passes this so the prospect gets a
 * clear button into the qualification funnel rather than a bare inline link.
 */
export function renderPlainHtml(
  body: string,
  recipientEmail?: string,
  cta?: EmailCta,
): string {
  const unsubscribeUrl = recipientEmail
    ? buildUnsubscribeUrl(recipientEmail)
    : undefined;
  return buildEmailHtmlShell(body, unsubscribeUrl, cta);
}
