/**
 * Shared email HTML shell.
 *
 * Used by the server-side send path (src/lib/email/send.ts) and the
 * client-side preview (src/components/admin/outreach/email-review-card.tsx).
 *
 * No `server-only` directive — this module is safe to import from both
 * server components/actions and client components. It has no side effects
 * and no heavy imports.
 *
 * Callers are responsible for sanitising `safeBodyHtml` before passing it:
 *  - Server path (send.ts): body is trusted agent-generated content.
 *  - Client preview: body must be DOMPurify-sanitised by the caller.
 *
 * Email inline styles cannot use CSS vars (`--ct-accent`) — mail clients strip
 * them — so the brand hex is interpolated from the single JS source of truth.
 */

import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

/**
 * Wraps `innerHtml` in the shared Hearst email outer container `<div>`.
 * Safe to import from both server and client modules (no `server-only`).
 */
export function buildEmailWrapper(innerHtml: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e5e7eb;border-radius:12px;">${innerHtml}</div>`;
}

/** Optional CTA button rendered between the body and the footer. */
export interface EmailCta {
  /** Absolute URL the button points to (e.g. the /apply qualification funnel). */
  url: string;
  /** Button label. Defaults to "Apply for access". */
  label?: string;
}

/**
 * Renders the email shell.
 *
 * `cta` (optional) renders a real, styled green button (same look as the
 * activation email) — used by cold outreach to give the prospect a clear
 * "Apply for access" button to the /apply qualification funnel, instead of a
 * bare inline link buried in the copy.
 *
 * `unsubscribeUrl` (optional) is substituted into the footer as a real
 * one-click opt-out link; when omitted, the footer line is dropped entirely (no
 * raw `{{unsubscribe}}` placeholder ever ships). Cold outreach MUST pass a URL —
 * compliance requires a working unsubscribe.
 */
export function buildEmailHtmlShell(
  safeBodyHtml: string,
  unsubscribeUrl?: string,
  cta?: EmailCta,
): string {
  const ctaButton = cta
    ? `<p style="margin:24px 0 0;">
            <a href="${cta.url}"
               style="display:inline-block;padding:12px 24px;background:${CONNECT_ACCENT_HEX};color:#0a0a0a;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">
              ${cta.label ?? "Apply for access"}
            </a>
          </p>`
    : "";
  const footer = unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
            <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>`
    : "";
  return `
        ${buildEmailWrapper(`
          <h2 style="color:${CONNECT_ACCENT_HEX};font-size:20px;margin:0 0 16px;">Hearst Connect</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
            ${safeBodyHtml}
          </p>
          ${ctaButton}
          ${footer}
        `)}
      `;
}
