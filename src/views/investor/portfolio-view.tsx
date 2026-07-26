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
import { EmptyState, Kpi, KpiGrid } from "@/ui";
import { StatusValue } from "@/ui/status-value";
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
 * /portfolio — le cockpit de position de l'investisseur.
 *
 * ── RÈGLE DE STRUCTURE (Adrien, 2026-07-26) ─────────────────────────────────
 * « N'importe quel chiffre qu'on ait, je veux toujours les placeholders
 * visibles, même si le score est à zéro, la data à zéro ou nulle. »
 * « Chaque placeholder a l'espace, chaque data a l'espace, et il n'y a pas de
 * changement de forme ni de volume quand une data arrive ou se charge. »
 *
 * CE QUE ÇA A CHANGÉ ICI, ET POURQUOI C'ÉTAIT UN BUG
 * Cette vue avait un `if (!wallet) return …` qui escamotait TOUT : les quatre
 * KPI, le bouton d'action et la section Positions disparaissaient, laissant un
 * titre et un message. Or l'absence de wallet ne rend illisibles que DEUX des
 * quatre métriques : `shares` et `whitelist` sont des lectures on-chain, tandis
 * que `principalUsdc` et `positions` viennent de la base investisseur et sont
 * parfaitement connus sans wallet. Le code le disait déjà pour la courbe
 * (« investor-level, not wallet-level … hiding it here would understate what we
 * actually hold ») mais n'appliquait la règle qu'à elle.
 *
 * Chaque bloc décide donc SEUL de sa lisibilité. Un wallet manquant devient un
 * état de tuile — avec son motif et son action — jamais un mur qui vide l'écran.
 *
 * ── ZÉRO N'EST PAS UNE ABSENCE ──────────────────────────────────────────────
 * Complément (et non contradiction) de la doctrine « jamais de zéro fabriqué » :
 * on n'INVENTE toujours pas un 0 quand on ne sait pas — mais un 0 MESURÉ
 * s'affiche comme un chiffre, avec sa provenance. `0 USDC` est une information ;
 * `—` n'en est pas une.
 */

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

/** Le motif affiché par une tuile on-chain quand aucun wallet n'est lié. */
const NO_WALLET_REASON = "no wallet is linked to this account yet";

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

  /* ── Les 4 métriques, chacune avec SA propre condition de lisibilité ──────
   * Deux sont investor-level (base) : connues même sans wallet.
   * Deux sont wallet-level (chaîne) : leur motif d'indisponibilité nomme la
   * cause réelle — absence de wallet ou lecture qui a échoué —, il ne se
   * contente pas d'un tiret. */

  // Investor-level. Un principal à 0 est une MESURE : il s'affiche.
  const principalTile = (
    <Kpi
      label="Principal deployed"
      value={`${formatUsdcGrouped(principalUsdc)} USDC`}
      provenance={valueSourceReachable ? "live" : "stale"}
      state={valueSourceReachable ? "ready" : "unavailable"}
      unavailableReason="no investor record is linked to this session"
      hint="Net subscriptions recorded to date"
    />
  );

  // Wallet-level : la lecture on-chain n'a de sens qu'avec un wallet.
  const sharesTile = (
    <Kpi
      label="Share balance"
      value={
        shares.status === "wired"
          ? formatShareAmount(shares.data.shares, shares.data.shareDecimals)
          : "—"
      }
      provenance="attested"
      state={shares.status === "wired" ? "ready" : "unavailable"}
      unavailableReason={
        wallet ? "the vault contract could not be read" : NO_WALLET_REASON
      }
      hint="Receipt tokens held on-chain"
    />
  );

  const whitelistTile = (
    <Kpi
      label="Subscription eligibility"
      value={
        whitelist.status === "wired"
          ? whitelist.data.whitelisted
            ? "Whitelisted"
            : "Not whitelisted"
          : "—"
      }
      provenance="oracle"
      state={whitelist.status === "wired" ? "ready" : "unavailable"}
      unavailableReason={
        wallet ? "the vault contract could not be read" : NO_WALLET_REASON
      }
      hint="Read directly from the vault contract"
    />
  );

  // Investor-level. Zéro position est un fait, pas un trou.
  const positionsTile = (
    <Kpi
      label="Active positions"
      value={String(positions.length)}
      provenance={valueSourceReachable ? "live" : "stale"}
      state={valueSourceReachable ? "ready" : "unavailable"}
      unavailableReason="no investor record is linked to this session"
      hint={positions.length === 1 ? "Series 1 vault" : "Across all vaults"}
    />
  );

  return (
    <PageLayout>
      <PageHeader
        title="My Position"
        meta={modeLabel}
        description="Your subscription position on the Series 1 vault — accumulated BTC delivered at maturity."
        actions={
          <PageActions
            primary={{ href: investProductPath("HYV-A"), label: "Subscribe more" }}
          />
        }
      />

      {/* La bande de KPI est TOUJOURS rendue, quelle que soit la donnée
          disponible : c'est la règle. Une tuile sans donnée dit pourquoi et
          occupe exactement la place qu'elle occupera une fois remplie. */}
      <KpiGrid>
        {principalTile}
        {sharesTile}
        {whitelistTile}
        {positionsTile}
      </KpiGrid>

      {/* Le wallet n'est plus un mur : c'est une ligne d'état, avec son action,
          rendue seulement quand elle a quelque chose à dire. */}
      {!wallet ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <StatusValue kind="not-linked" label="No wallet linked" />
              <p className="hc-caption">
                On-chain reads (share balance, eligibility) need a linked wallet.
                Everything recorded off-chain is shown above.
              </p>
            </div>
            <Link
              href="/profile"
              className="hc-link shrink-0 text-sm font-medium"
            >
              Link a wallet
            </Link>
          </div>
        </Panel>
      ) : null}

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

      <Section title="Positions">
        <Panel>
          {positions.length === 0 ? (
            <EmptyState
              title="No active positions"
              description="Subscriptions appear here once they settle. Nothing is estimated — an empty list means none has been recorded."
            />
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
    </PageLayout>
  );
}
