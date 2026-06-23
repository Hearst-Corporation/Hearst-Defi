/**
 * Resolves the call-to-action (CTA) URL embedded in every cold-outreach email.
 *
 * Despite the legacy `NEXT_PUBLIC_TYPEFORM_URL` name, the default CTA is the
 * app's own in-app qualification funnel (`/apply`) — NOT a Typeform. The
 * resolution order is:
 *
 *   1. NEXT_PUBLIC_QUALIFICATION_FORM_URL — an explicit, absolute CTA override
 *      (use this to point at a real external form if one ever exists again).
 *   2. NEXT_PUBLIC_TYPEFORM_URL — legacy alias for the same explicit override.
 *   3. `${appBase}/apply` — the in-app funnel, where `appBase` is
 *      NEXT_PUBLIC_APP_URL (the var that already controls where the app runs,
 *      and the same base used by buildUnsubscribeUrl) falling back to the prod
 *      host only as a last resort.
 *
 * Centralising this (previously duplicated verbatim in actions.ts and
 * outreach-followups.ts) means a single per-env override — set
 * NEXT_PUBLIC_APP_URL=http://localhost:4105 locally — correctly retargets the
 * CTA away from the production host for any non-prod / preview environment,
 * instead of every drafted email silently embedding https://connect.hearst.app.
 */

const PROD_APP_HOST = "https://connect.hearst.app";

/** Strips a single trailing slash so URL joins never double up. */
function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * The absolute CTA URL (qualification funnel) to embed in cold emails. Always
 * absolute so the link is valid in the recipient's inbox regardless of where it
 * was rendered.
 */
export function resolveCtaUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_QUALIFICATION_FORM_URL ??
    process.env.NEXT_PUBLIC_TYPEFORM_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }
  const appBase = trimTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ?? PROD_APP_HOST,
  );
  return `${appBase}/apply`;
}
