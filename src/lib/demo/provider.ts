// Demo Provider — foundations only (Lot 1).
//
// Identity recognition for the demo sandbox. NOT branched into any loader, page,
// action, or auth path yet. The demo identity reuses the existing
// DEMO_INVESTOR_EMAIL so there is a single source of truth.

import { DEMO_INVESTOR_EMAIL } from "@/lib/dev/investor-demo";

import { canRunDemoProvider } from "./guard";

export { DEMO_INVESTOR_EMAIL };

/**
 * Minimal structural shape needed to recognize the demo identity. A real Prisma
 * `Investor` (which has `email: string | null`) satisfies this, so callers can
 * pass `getInvestor()` directly without this module importing Prisma types or
 * `server-only`.
 */
export interface DemoIdentityInvestor {
  email: string | null;
}

/**
 * True only when the demo provider is enabled (guard) AND the investor is the
 * recognized demo identity. Fail-closed: returns false if the guard is off or
 * the investor is absent. Does not touch `getInvestor()` or auth.
 *
 * `enabled` is injectable (defaults to the real guard) so this is unit-testable
 * without mutating process.env.
 */
export function isDemoInvestor(
  investor: DemoIdentityInvestor | null | undefined,
  enabled: boolean = canRunDemoProvider(),
): boolean {
  if (!enabled) return false;
  if (!investor) return false;
  return investor.email === DEMO_INVESTOR_EMAIL;
}
