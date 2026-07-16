export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { Card } from "@/components/catalyst/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  ALLOCATION_TOTAL_BPS,
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
} from "@/lib/products/dynavault-factsheet";

/**
 * Admin · BTC Mining Performance Vault — read-only product surface.
 *
 * Renders the committed product (`src/lib/products/*`) as an admin documentation
 * page on the canon shell (AdminPageShell + AdminSectionCard, DS tokens only).
 *
 * Honesty (non-negotiables #1, #5, #10; methodology v3.0 / ADR-019):
 *  - this is a mining NOTE: BTC is ACCUMULATED over the ~24-month term (rule-based
 *    take-profit) and delivered at maturity — there is NO periodic cash
 *    distribution and NO fixed APY;
 *  - the estimated-return band and the total target are BOTH ranges, expressed as
 *    accumulated BTC, and are NEVER summed into a single headline;
 *  - allocation is FIXED on-chain across three pockets — B1 Mining Power 40%,
 *    B2 BTC Pouch 27%, B3 Reserve USDC 33% (from the factsheet bps constants);
 *  - outcomes are shaped by three on-chain mechanisms (take-profit / vending /
 *    curtailment), NOT by reallocating pockets;
 *  - configured values are labelled "configured, not validated" behind a warning.
 *
 * No data fetch, no record creation, no run, no deploy implied.
 */

const PRODUCT = BTC_MINING_PERFORMANCE_VAULT;

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

function bpsToPct(bps: number): number {
  return Math.round((bps / ALLOCATION_TOTAL_BPS) * 100);
}

export const metadata = {
  title: "BTC Mining Performance Vault — Hearst Connect",
};

export default async function BtcMiningPerformanceVaultPage() {
  await requireAdmin();

  // v3.0 objective — held in-page (not the LLM-fallback brief, whose legacy
  // "monthly distribution paid in USDC" copy contradicts the accumulation model).
  const objective =
    "Package a real, mining-first Bitcoin operation into an investable performance cycle: BTC accumulated over the term across three fixed on-chain pockets and delivered at maturity, an inclusive full-cycle performance target, an early-exit mechanism, and a capital-first recovery extension — target and expected, risk-adjusted and collateral-protected, never guaranteed and never a periodic cash distribution.";

  // Fixed on-chain allocation — three pockets, 40/27/33, from the factsheet bps
  // constants (never re-hardcoded here). Allocation does NOT float across bands;
  // outcomes are shaped by the three mechanisms below, not by reallocation.
  const pockets: ReadonlyArray<{
    id: string;
    label: string;
    weight: string;
    note: string;
  }> = [
    {
      id: "b1",
      label: "B1 · Mining Power",
      weight: `${bpsToPct(B1_MINING_ALLOCATION_BPS)}%`,
      note: "Productive core — net mining margin accrues to the note as BTC.",
    },
    {
      id: "b2",
      label: "B2 · BTC Pouch",
      weight: `${bpsToPct(B2_BTC_ALLOCATION_BPS)}%`,
      note: "BTC accumulated over the term; realised at configured take-profit tiers.",
    },
    {
      id: "b3",
      label: "B3 · Reserve USDC",
      weight: `${bpsToPct(B3_USDC_ALLOCATION_BPS)}%`,
      note: "Depletes along a fixed vending curve to fund operations.",
    },
  ];

  const mechanisms: ReadonlyArray<{ id: string; label: string; note: string }> = [
    {
      id: "take-profit",
      label: "Take-profit (B2)",
      note: "BTC realised at configured price tiers — a realisation event, not an LP distribution.",
    },
    {
      id: "vending",
      label: "Vending curve (B3)",
      note: "Reserve USDC depletes along a fixed schedule across the term to fund operations.",
    },
    {
      id: "curtailment",
      label: "Curtailment (B1)",
      note: "Mining curtailed when BTC sits below the configured pre/post-halving threshold.",
    },
  ];

  return (
    <AdminPageShell
      titleLead="BTC Mining"
      titleAccent="Performance Vault"
      contextLabel="Products · configured, not validated"
    >
      {/* Warning strip — mandatory investor-facing notice. */}
      <AdminSectionCard ariaLabel="Status warning">
        <div className="flex items-start gap-3 border-l-2 border-[var(--ct-status-warning)] p-5">
          <span className="ct-bento-label text-[var(--ct-status-warning)]">
            Status
          </span>
          <p className="ct-metric-caption">
            Targets are not guarantees. Configured assumptions require admin
            validation before investor-facing use.
          </p>
        </div>
      </AdminSectionCard>

      {/* Thesis + targets */}
      <AdminSectionCard
        title="Thesis"
        subtitle={PRODUCT.thesis}
        ariaLabel="Thesis"
      >
        <div className="flex flex-col gap-5 p-5">
          <p className="ct-metric-caption">{objective}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">Estimated return band</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {pct(PRODUCT.monthlyDistributionTargetAnnualized.min)}–
                {pct(PRODUCT.monthlyDistributionTargetAnnualized.max)}%
              </span>
              <span className="ct-metric-caption">
                Mining note — BTC accumulated over the ~
                {PRODUCT.targetDurationMonths}-month term with rule-based
                take-profit and delivered at maturity. Not distributed, not
                guaranteed.
              </span>
            </Card>
            <Card
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">Total performance target</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {pct(PRODUCT.totalPerformanceTarget.min)}–
                {pct(PRODUCT.totalPerformanceTarget.max)}%
              </span>
              <span className="ct-metric-caption">
                {pct(PRODUCT.totalPerformanceTarget.min)}–
                {pct(PRODUCT.totalPerformanceTarget.max)}% total target over ~
                {PRODUCT.targetDurationMonths} months, inclusive of the
                accumulation band.
              </span>
            </Card>
          </div>
          <p className="ct-metric-caption italic">
            Both bands are ranges expressed as accumulated BTC — the total target
            is inclusive of the estimated-return band and the two never sum. There
            is no periodic cash distribution and no fixed APY.
          </p>
        </div>
      </AdminSectionCard>

      {/* Allocation — three fixed on-chain pockets, 40/27/33 */}
      <AdminSectionCard
        title="On-chain allocation"
        subtitle="Three pockets, fixed on-chain — 40 / 27 / 33. Outcomes are shaped by mechanisms, not by reallocation."
        ariaLabel="On-chain allocation"
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {pockets.map((p) => (
            <Card
              key={p.id}
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">{p.label}</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {p.weight}
              </span>
              <span className="ct-metric-caption">{p.note}</span>
            </Card>
          ))}
        </div>
      </AdminSectionCard>

      {/* Mechanisms — the three on-chain levers that shape outcomes */}
      <AdminSectionCard
        title="Mechanisms"
        subtitle="Take-profit, vending curve, curtailment — configured contract values, never a performance claim."
        ariaLabel="Mechanisms"
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {mechanisms.map((m) => (
            <Card
              key={m.id}
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">{m.label}</span>
              <span className="ct-metric-caption">{m.note}</span>
            </Card>
          ))}
        </div>
      </AdminSectionCard>

      {/* Structural facts */}
      <AdminSectionCard
        title="Structure"
        subtitle="Term, allocation, BTC delivery, recovery — configured."
        ariaLabel="Structure"
      >
        <ul className="flex flex-col gap-2 p-5 ct-metric-caption">
          <li>
            • Term:{" "}
            <span className="text-[var(--ct-text-strong)]">
              ~{PRODUCT.targetDurationMonths} months
            </span>{" "}
            — BTC accumulated over the term and delivered at maturity (early
            closure on target hit).
          </li>
          <li>
            • Fixed allocation:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {bpsToPct(B1_MINING_ALLOCATION_BPS)} /{" "}
              {bpsToPct(B2_BTC_ALLOCATION_BPS)} /{" "}
              {bpsToPct(B3_USDC_ALLOCATION_BPS)}
            </span>{" "}
            (B1 Mining Power / B2 BTC Pouch / B3 Reserve USDC), set on-chain.
          </li>
          <li>
            • Return delivery:{" "}
            <span className="text-[var(--ct-text-strong)]">
              accumulated BTC at maturity
            </span>{" "}
            — no periodic cash distribution, no fixed APY.
          </li>
          <li>
            • Minimum ticket &amp; soft lock-up:{" "}
            <span className="text-[var(--ct-text-strong)]">
              contractual / applicative
            </span>{" "}
            — not enforced on-chain (on-chain gates are the TVL cap + whitelist).
          </li>
          <li>
            • Recovery extension:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {PRODUCT.recovery.extensionMonths.min}–
              {PRODUCT.recovery.extensionMonths.max} months
            </span>{" "}
            — Mode A ({PRODUCT.recovery.defaultMode}) default; not a guarantee of
            recovery.
          </li>
          <li>
            • Status:{" "}
            <span className="text-[var(--ct-status-warning)]">
              {PRODUCT.status} — not validated
            </span>
            .
          </li>
        </ul>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
