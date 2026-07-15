import "server-only";

import { z } from "zod";

/**
 * Minimum-ticket resolution — THE single source of truth for the applicative
 * minimum subscription amount, in whole USDC (the vault asset is USDC, 6 dp).
 *
 * ── WHY THIS MODULE EXISTS: the "deposit-then-reject" hazard ───────────────
 *
 * Two independent code paths decide what an investor may deposit:
 *
 *   1. the DATA layer (src/lib/data/vaults.ts) → `vault.minTicketUsdc`, which
 *      the invest form renders AND client-side-gates on
 *      (`amount >= vault.minTicketUsdc`, invest-form.tsx);
 *   2. the SERVER ACTION (`validateMinTicket`,
 *      src/lib/positions/subscribe-logic.ts), which re-validates the amount —
 *      but only AFTER the on-chain deposit has already settled.
 *
 * If (1) accepts a number that (2) rejects, the investor's USDC is already gone
 * on-chain and irreversible while `subscribe()` refuses to create the Position:
 * money in, no position, no way back. Both paths MUST therefore derive their
 * threshold from this module and nothing else. That contract is pinned by
 * src/lib/vaults/__tests__/min-ticket.test.ts — it is the test that forbids the
 * regression, not a comment.
 *
 * ── ENGINE PURITY (non-negotiable #6) ─────────────────────────────────────
 *
 * `src/lib/engine/*` is pure: no DB, no fetch, no I/O — therefore no
 * `process.env`. The share-class presets (`SHARE_CLASS_A.minTicketUsdc` =
 * 250_000) stay the untouched *product default*; this module is the
 * *deployment* layer that may lower it for a given environment. That is exactly
 * why the override is resolved here and never inside the engine.
 *
 * ── WHY `server-only` ─────────────────────────────────────────────────────
 *
 * `MIN_TICKET_USDC` is deliberately NOT a `NEXT_PUBLIC_` var. In a client
 * component `process.env.MIN_TICKET_USDC` is `undefined`, so a resolver called
 * from the browser would silently return the un-overridden base and re-open the
 * exact divergence described above — the worst kind of bug: invisible, and it
 * costs the investor money. This marker turns that mistake into a build error.
 * The client never needs it anyway: the invest form receives the already
 * resolved `vault.minTicketUsdc` as a prop from a Server Component (see
 * src/app/(product)/vaults/[id]/invest/page.tsx → getVault() → <InvestForm />).
 */

/**
 * Parse rule for the override. Exported and reused by `src/lib/env.ts` so the
 * boot-time validation and this call-time read can never drift apart.
 *
 * Tolerant by design — a value that does not parse resolves to "absent", which
 * means the canonical base applies. Two properties fall out of that, both
 * intentional:
 *   - a typo RAISES the floor back to the product default, it can never lower
 *     it (fail-safe direction);
 *   - `"0"` / `"-5"` are rejected by `.positive()`, so a misconfiguration can
 *     never produce a floor of 0 that would accept a 0 USDC ticket.
 */
export const MIN_TICKET_USDC_ENV_SCHEMA = z.coerce.number().positive().finite();

/** Canonical env var name. */
export const MIN_TICKET_ENV_VAR = "MIN_TICKET_USDC";

/**
 * Legacy alias. Kept ONLY because it is already provisioned (production env and
 * .env.local) with the value this change wants, so the fix takes effect on
 * deploy instead of waiting on an ops action. Strictly lower precedence than
 * `MIN_TICKET_USDC`, and deprecated: `env.ts` warns in production when this is
 * the var actually doing the work, because a name starting with `DEMO_` driving
 * a real money floor is a trap worth surfacing rather than hiding.
 */
export const MIN_TICKET_LEGACY_ENV_VAR = "DEMO_MIN_TICKET_USDC";

export interface MinTicketOverride {
  /** Effective floor, in whole USDC. Always > 0 and finite. */
  usdc: number;
  /** Which env var supplied it — drives the deprecation warning in env.ts. */
  source: "MIN_TICKET_USDC" | "DEMO_MIN_TICKET_USDC";
}

function parseOverride(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const parsed = MIN_TICKET_USDC_ENV_SCHEMA.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The configured override, or `null` when none is set (or the value is
 * unusable). Read at CALL time and never memoised: the resolved number must
 * follow `process.env` across a test's `vi.stubEnv` and across a server
 * restart, and this is not a hot path.
 */
export function readMinTicketOverride(): MinTicketOverride | null {
  const canonical = parseOverride(process.env[MIN_TICKET_ENV_VAR]);
  if (canonical !== null) {
    return { usdc: canonical, source: "MIN_TICKET_USDC" };
  }
  const legacy = parseOverride(process.env[MIN_TICKET_LEGACY_ENV_VAR]);
  if (legacy !== null) {
    return { usdc: legacy, source: "DEMO_MIN_TICKET_USDC" };
  }
  return null;
}

/**
 * Resolve the effective minimum ticket for a given canonical base.
 *
 * `baseUsdc` is the number that applies with NO override configured — the
 * `VaultDeployment.minTicketUsdc` column on the data side, the share-class
 * preset on the validation side. An unset (or unusable) env therefore changes
 * NOTHING: that is the "default 250_000" contract — 250_000 is already the
 * base, so a deployment that does not set the var keeps its exact current
 * behaviour, including any vault whose configured minimum is not 250_000.
 *
 * Honored in EVERY environment, production included. This is the deliberate
 * behavioural change: the previous gate (`isDevelopment || NODE_ENV !==
 * "production"`) made the override inert in production, which is why the invest
 * CTA has never produced a single real deposit.
 */
export function resolveMinTicketUsdc(baseUsdc: number): number {
  return readMinTicketOverride()?.usdc ?? baseUsdc;
}
