
import type { PortfolioData } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { relativeTime } from "@/lib/format/time";

interface PortfolioGreetingProps {
  /** Display name — email local-part or shortened wallet. */
  name: string;
  data: PortfolioData;
}

/**
 * Welcome line above the KPI band: greeting + a one-glance activity recap.
 * Server Component. Pure derivation from already-loaded portfolio data — no
 * extra fetch. Tokens/classes only (design-lock respected).
 *
 * The primary call-to-action lives in <NextActionCard>, rendered just below —
 * the greeting stays a calm header so a single action leads each screen.
 */
export function PortfolioGreeting({ name, data }: PortfolioGreetingProps) {
  const count = data.positions.length;
  // "As of now" — this is a Server Component on a force-dynamic page, so the
  // reference resolves to request time (NOT a frozen date), keeping the
  // "last activity N days ago" recap accurate. UI-side only; engine purity
  // (no Date.now() in src/lib/engine) is unaffected.
  const asOf = new Date();
  const last = data.recentTransactions[0];

  const recap =
    count === 0
      ? "Preview mode · no active positions yet."
      : `${count} active position${count > 1 ? "s" : ""} · ${formatUsdCompact(
          data.totalValueUsdc,
        )} deployed${last ? ` · last activity ${relativeTime(last.occurredAt, asOf)}` : ""}`;

  return (
    <div className="pf-greeting">
      <h1 className="h1">
        Welcome back, <span className="pf-greeting-name">{name}</span>
      </h1>
      <p className="pf-greeting-recap tabular">{recap}</p>
    </div>
  );
}
