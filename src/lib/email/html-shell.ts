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
 */

/**
 * Wraps `innerHtml` in the shared Hearst email outer container `<div>`.
 * Safe to import from both server and client modules (no `server-only`).
 */
export function buildEmailWrapper(innerHtml: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e5e7eb;border-radius:12px;">${innerHtml}</div>`;
}

export function buildEmailHtmlShell(safeBodyHtml: string): string {
  return `
        ${buildEmailWrapper(`
          <h2 style="color:#A7FB90;font-size:20px;margin:0 0 16px;">Hearst Connect</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
            ${safeBodyHtml}
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
            {{unsubscribe}}
          </p>
        `)}
      `;
}
