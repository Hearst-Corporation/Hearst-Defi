// /portfolio — product-terms loader.
//
// The KPI band used to hard-code "24 months" / "60 days": literals that the
// backend factsheet exists to replace. This loader reads the terms from
// hearst-connect-backend; the per-wallet position reads stay on the chain
// adapter in the page (the backend does not serve per-wallet facts in v1 —
// replacing a real read with null would be the inverse regression).
//
// Absence and outage stay distinct: null term with reachable=true means the
// factsheet honestly does not report it; reachable=false means we could not
// ask.

import "server-only";

import { getProductFactsheetFromBackend, isBackendError } from "@/lib/backend";
import { logger } from "@/lib/logger";

export interface PortfolioTerms {
  readonly reachable: boolean;
  readonly termMonths: number | null;
}

export async function loadPortfolioTerms(): Promise<PortfolioTerms> {
  try {
    const envelope = await getProductFactsheetFromBackend();
    const terms = envelope.data.terms;
    return {
      reachable: true,
      termMonths: terms.value?.productDurationMonths ?? null,
    };
  } catch (err) {
    logger.error("portfolio terms backend read failed", {
      error: isBackendError(err) ? err.message : String(err),
    });
    return { reachable: false, termMonths: null };
  }
}
