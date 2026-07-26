import Link from "next/link";

import { formatShareAmount } from "@/lib/chain/wired-view";
import type { Wired, UserShares, WhitelistStatus } from "@/lib/chain/dynavault";
import type { NavSeriesKind, PortfolioPosition } from "@/lib/data/portfolio";
import type { VaultMode } from "@/lib/chain/vault-mode";
import type { Provenance } from "@/lib/provenance";
import { formatUsdcGrouped } from "@/lib/vaults/product-display";
import {
  PageActions,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
  PRODUCT_FORM_SURFACE,
} from "@/views/_shared/product-layout";
import { investProductPath } from "@/lib/vaults/invest-routes";
import { Badge, EmptyState, Kpi, KpiGrid, ProvenanceBadge } from "@/ui";
// Deep import on purpose: `@/ui` does NOT re-export the charts, so recharts
// stays out of the bundle of every route that has no plot.
import type {
  PerformanceChartState,
  PerformancePoint,
} from "@/ui/chart";
// Le graphique passe par un ÎLOT en next/dynamic : importé statiquement, il
// faisait entrer recharts (+ Redux Toolkit, immer, victory-vendor) dans le
// bundle initial de cette route — mesuré à +123 kB gz. Les types, eux,
// s'importent en `import type` : effacés au build, ils ne tirent rien.
import { PerformanceChartIsland } from "@/ui/performance-chart-island";

/**
 * Copy for the value card. Two facts the reader is owed, and neither is
 * decoration:
 *   - the CADENCE (hourly) — the newest point can be up to an hour old, so the
 *     curve is never "real-time";
 *   - the ORIGIN — a reconstructed path says so, in its subtitle AND in its
 *     provenance badge ("Estimated"), never quietly.
 */
const VALUE_SUBTITLE: Record<NavSeriesKind, string> = {
  measured:
    "Recorded value of your position, one point per hour in USDC. The newest point can be up to an hour old.",
  reconstructed:
    "Reconstructed from your real position anchors — hourly value prints do not cover this period yet. Endpoints are real, the path between them is modelled.",
  none: "Value points are recorded hourly in USDC once a position is active.",
};

const VALUE_EMPTY_MESSAGE =
  "No value points recorded yet — the hourly job writes one point per hour once a position is active.";

export function PortfolioView({
  modeLabel,
  wallet,
  shares,
  whitelist,
  positions,
  principalUsdc,
  valuePoints,
  valueProvenance,
  valueSeriesKind,
  valueSourceReachable,
}: {
  mode: VaultMode;
  modeLabel: string;
  wallet: string | null;
  shares: Wired<UserShares>;
  whitelist: Wired<WhitelistStatus>;
  positions: PortfolioPosition[];
  principalUsdc: number;
  /** Hourly value series, epoch-ms timestamps (RSC-serialisable). */
  valuePoints: PerformancePoint[];
  /** Provenance of `valuePoints` — derived at the loader, never chosen here. */
  valueProvenance: Provenance;
  /** Measured prints vs deterministic reconstruction vs nothing. */
  valueSeriesKind: NavSeriesKind;
  /**
   * false when the portfolio loader fell back (no investor record for this
   * session) — the series was never read, which is NOT "the series is empty".
   */
  valueSourceReachable: boolean;
}) {
  // empty ≠ unavailable: an unreachable source cannot claim "no points".
  const valueState: PerformanceChartState = !valueSourceReachable
    ? {
        kind: "unavailable",
        reason:
          "no investor record is linked to this session, so no value history could be read.",
      }
    : valuePoints.length === 0
      ? { kind: "empty", message: VALUE_EMPTY_MESSAGE }
      : { kind: "ready", points: valuePoints };

  const valueCard = (
    <Panel title="Position value" description={VALUE_SUBTITLE[valueSeriesKind]}>
      <div className={PRODUCT_FORM_SURFACE}>
        {/* No formatValue/formatDate passed: functions do not cross the RSC
            boundary. The client component owns its defaults. */}
        <PerformanceChartIsland
          state={valueState}
          provenance={valueProvenance}
          seriesLabel="Value (USDC)"
          ariaLabel="Position value over time, in USDC, from hourly value points"
          // The caveat travels WITH the plot, not only in the card subtitle:
          // the chart is portable, the card chrome is not.
          footnote={
            valueSeriesKind === "reconstructed"
              ? "Modelled path between real position anchors — not an hourly measurement."
              : undefined
          }
        />
      </div>
    </Panel>
  );


  if (!wallet) {
    return (
      <PageLayout>
        <PageHeader
          title="My Position"
          meta={modeLabel}
          description="Your subscription position on the Series 1 vault."
        />
        <EmptyState
          title="No wallet linked"
          description="Link a wallet in Profile to see your on-chain position."
          action={
            <Link href="/profile" className="text-sm text-accent-ink hover:underline">
              Go to Profile
            </Link>
          }
        />
        {/* The value series is investor-level (database), not wallet-level:
            it is real and readable even before a wallet is linked, so hiding
            it here would understate what we actually hold. */}
        {valueCard}
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="My Position"
        meta={modeLabel}
        description="Your share receipts and subscription status — no fabricated zeros."
        actions={
          <PageActions
            primary={{ href: investProductPath("HYV-A"), label: "Subscribe more" }}
          />
        }
      />

      <KpiGrid>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Principal deployed"
              value={
                principalUsdc > 0
                  ? `${formatUsdcGrouped(principalUsdc)} USDC`
                  : "—"
              }
              provenance="live"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Share balance"
              value={
                shares.status === "wired"
                  ? formatShareAmount(shares.data.shares, shares.data.shareDecimals)
                  : "—"
              }
              provenance={shares.status === "wired" ? "attested" : "stale"}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Whitelist"
              value={
                whitelist.status === "wired"
                  ? whitelist.data.whitelisted
                    ? "Yes"
                    : "No"
                  : "—"
              }
              provenance="oracle"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Positions"
              value={String(positions.length)}
              provenance="manual"
            />
          </div>
        </Panel>
      </KpiGrid>

      {valueCard}

      <Section title="Positions">
        <Panel>
          {positions.length === 0 ? (
            <EmptyState title="No active positions" />
          ) : (
            <RowList>
              {positions.map((p) => (
                <Row
                  key={p.id}
                  label={p.vaultName ?? "Series 1 Reserve Vault"}
                  value={`${formatUsdcGrouped(p.principalUsdc)} USDC`}
                />
              ))}
            </RowList>
          )}
        </Panel>
      </Section>

      <Badge variant="outline">
        <ProvenanceBadge source="live" /> On-chain reads where configured
      </Badge>
    </PageLayout>
  );
}
