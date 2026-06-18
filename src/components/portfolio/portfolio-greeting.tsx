
import type { PortfolioData } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { relativeTime } from "@/lib/format/time";

interface PortfolioGreetingProps {
  /** Display name — email local-part or shortened wallet. */
  name: string;
  data: PortfolioData;
  previewZeros?: boolean;
}

/**
 * Welcome line above the cockpit: greeting + a one-glance activity recap.
 * Server Component. Pure derivation from already-loaded portfolio data — no
 * extra fetch. Tokens/classes only (design-lock respected).
 */
export function PortfolioGreeting({
  name,
  data,
  previewZeros = false,
}: PortfolioGreetingProps) {
  const activeCount = data.positions.filter((p) => p.status === "active").length;
  // "As of now" — this is a Server Component on a force-dynamic page, so the
  // reference resolves to request time (NOT a frozen date), keeping the
  // "last activity N days ago" recap accurate. UI-side only; engine purity
  // (no Date.now() in src/lib/engine) is unaffected.
  const asOf = new Date();
  const last = data.recentTransactions[0];

  const recap = previewZeros
    ? "No position yet — subscribe to deploy capital into the vault."
    : activeCount === 0
      ? "No active positions · review exited positions below."
      : `${activeCount} active position${activeCount > 1 ? "s" : ""} · ${formatUsdCompact(
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
