/**
 * Demo-account allowlist.
 *
 * Gates the in-app "Reset my demo" control (and its server action) to a small,
 * explicit set of throwaway demo accounts. A real investor must NEVER see or be
 * able to trigger the destructive reset — this is the single source of truth for
 * "is this a demo account".
 *
 * The list is intentionally hard-coded (not env-driven): demo accounts are a
 * fixed, reviewed set, and an env var would be one more thing to misconfigure in
 * production. Case-insensitive match on the session email.
 */

const DEMO_EMAILS: readonly string[] = [
  "adrien+demo@hearstcorporation.io",
];

/** True when `email` belongs to a sanctioned demo account. */
export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEMO_EMAILS.includes(email.trim().toLowerCase());
}
