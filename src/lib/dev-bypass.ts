/**
 * Dev-only authentication bypass.
 *
 * When enabled, the edge gate (`proxy.ts`) lets every protected route through
 * and `getSession()` returns a seeded dev user without requiring a login.
 *
 * DOUBLE-GATED — both conditions are required, so this can NEVER activate in a
 * production build:
 *   1. `NODE_ENV !== "production"` (Next sets NODE_ENV=production for `next build`/`start`).
 *   2. `DEV_AUTH_BYPASS === "1"` — explicit opt-in flag (off by default).
 *
 * Edge-safe: reads only `process.env` (no Prisma, no Node APIs), so it can be
 * imported from both `proxy.ts` (edge) and `session.ts` (server).
 */
export function isDevAuthBypass(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1"
  );
}

/** Email of the auto-provisioned dev user used by the bypass. */
export const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@hearst.local";

/** Role of the auto-provisioned dev user. Defaults to admin for admin QA. */
export const DEV_USER_ROLE =
  process.env.DEV_USER_ROLE === "investor" ? "investor" : "admin";
