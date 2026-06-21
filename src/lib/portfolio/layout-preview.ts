import { INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";

/**
 * Cold-start surfaces (e.g. proof center) route to the product CATALOGUE, not a
 * hardcoded deep invest link. A cold investor lands where availability is shown
 * honestly — the catalogue renders its own "no vault deployed" empty state —
 * instead of dead-ending on a specific vault's invest page that may not be live.
 */
export const PORTFOLIO_ONBOARDING_INVEST_HREF = INVEST_SELECT_PATH;
