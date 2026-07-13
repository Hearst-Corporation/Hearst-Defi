// /mining — Mining Operations console (Bitcoin Strategic Reserve reposition, Phase P2).
//
// Read-only, zero-migration operational page. Reuses the SAME loaders/composers
// already shipped for /bitcoin-reserve (`loadBitcoinReserveView`) and /portfolio
// (`loadMiningMetrics`), plus the machine MARKET catalog (`loadMachineMarket`) —
// no new data source, no new schema. Every figure carries an honest provenance
// badge; nothing here is ever upgraded to "live". Per-ASIC telemetry (temperature,
// runtime, health score, individual online/offline status) does not exist in the
// schema at all — this page names that gap explicitly instead of fabricating it.
//
// Server Component — gated by the (product) layout (session required);
// `requireInvestor` called again here too, matching the /bitcoin-reserve
// convention (defensive double-gate, not redundant plumbing).

import type { ReactNode } from "react";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { ManufacturerLogo } from "@/components/admin/source/manufacturer-mark";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { loadMiningMetrics } from "@/lib/data/mining-metrics";
import { loadMachineMarket, type MachineRow } from "@/lib/telegram/read-machines";
import { computeBtcPerThDay } from "@/lib/engine/mining-economics";
import { formatBtc, formatHashrate } from "@/lib/format/btc";

import type { StatCell } from "../portfolio/preview/_charts/stat-band";
import { StatBand } from "../portfolio/preview/_charts/stat-band";
import { HcUptimeBand } from "../portfolio/preview/_charts/uptime-band";
import { HcBullet } from "../portfolio/preview/_charts/bullet";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mining Operations — Hearst Connect" };

/** Bare-hairline support surface (matches /bitcoin-reserve's SUPPORT recipe). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";

/** Titled hairline divider — opens an act without boxing it in a card. */
function TitledDivider({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <h2 className="ct-section-title shrink-0">{title}</h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: "var(--ct-border-soft)" }}
      />
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export default async function MiningOperationsPage() {
  await requireInvestor("/mining");

  const [reserveView, miningMetrics, machineMarket] = await Promise.all([
    loadBitcoinReserveView(),
    loadMiningMetrics(),
    loadMachineMarket(),
  ]);

  const { fleetProduction, networkHashrateThs } = reserveView;

  // Fleet hashrate — the SAME allocatedHashrate string /portfolio already
  // renders (parsed back to a number just for formatHashrate's canonical
  // auto-scaling; the string itself is the source of truth).
  const fleetHashrateThs = miningMetrics
    ? parseHashrateThs(miningMetrics.allocatedHashrate)
    : null;

  const overviewStats: StatCell[] = [
    {
      label: "Fleet Hashrate",
      value: fleetHashrateThs !== null ? formatHashrate(fleetHashrateThs) : "—",
      provenance: "estimated",
      valueTone: "btc",
    },
    {
      label: "Efficiency",
      value: miningMetrics ? `${miningMetrics.efficiency.value.toFixed(1)}` : "—",
      affix: "J/TH",
      provenance: "estimated",
    },
    {
      label: "BTC Produced Today",
      value: fleetProduction ? formatBtc(fleetProduction.value.btcPerDay) : "—",
      affix: fleetProduction ? "BTC" : undefined,
      provenance: fleetProduction ? fleetProduction.provenance : "estimated",
      valueTone: "btc",
    },
    {
      label: "BTC Produced This Month",
      value: fleetProduction ? formatBtc(fleetProduction.value.btcPerMonth) : "—",
      affix: fleetProduction ? "BTC" : undefined,
      provenance: fleetProduction ? fleetProduction.provenance : "estimated",
      valueTone: "btc",
    },
  ];

  // Per-unit production rate for the reference table — derived from the SAME
  // pure formula bitcoin-reserve-view.ts already uses (block-reward share at
  // current network hashrate), applied per-row's own TH/unit. Skipped (—)
  // when network hashrate is unavailable rather than showing a false 0.
  const btcPerThDay =
    networkHashrateThs.value > 0 ? computeBtcPerThDay(networkHashrateThs.value) : 0;

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        <PortfolioLeafHeader
          titleLead="Mining"
          titleAccent="Operations"
          kicker="MINING-AS-A-SERVICE"
        />

        {/* ── Act: Overview ─────────────────────────────────────────────── */}
        <TitledDivider
          title="Overview"
          trailing={
            <ProvenanceBadge
              kind="estimated"
              variant="compact"
              description="Estimated — fleet-level operational reading, not a per-unit measurement."
            />
          }
        />
        <div className={SUPPORT}>
          <StatBand items={overviewStats} />
        </div>

        {/* ── Act: Fleet uptime ─────────────────────────────────────────── */}
        <TitledDivider
          title="Fleet uptime by cause"
          trailing={
            miningMetrics ? (
              <ProvenanceBadge
                kind="estimated"
                variant="compact"
                description="Estimated — the schema stores a single uptimePct reading, not a per-cause breakdown; downtime is bucketed conservatively as 'unscheduled'."
              />
            ) : undefined
          }
        />
        <div className={SUPPORT}>
          {miningMetrics ? (
            <div className="p-5">
              <HcUptimeBand
                segments={miningMetrics.uptimeSegments}
                aria-label="Fleet uptime by cause"
              />
            </div>
          ) : (
            <EmptySurface
              variant="chart"
              message="Fleet uptime by cause — awaiting a real telemetry feed."
              detail="No MiningMetric rows exist yet, so no uptime figure is fabricated."
            />
          )}
        </div>

        {/* ── Act: Efficiency ───────────────────────────────────────────── */}
        <TitledDivider
          title="Efficiency"
          trailing={
            miningMetrics ? (
              <ProvenanceBadge
                kind="estimated"
                variant="compact"
                description="Estimated — a model derived from energy cost and hashprice, not a hardware telemetry reading."
              />
            ) : undefined
          }
        />
        <div className={SUPPORT}>
          {miningMetrics ? (
            <div className="flex flex-col gap-2 p-5">
              <HcBullet
                value={miningMetrics.efficiency.value}
                min={miningMetrics.efficiency.ranges[0] - 2}
                max={miningMetrics.efficiency.max}
                target={miningMetrics.efficiency.target}
                ranges={[...miningMetrics.efficiency.ranges]}
                tone={
                  miningMetrics.efficiency.value <= miningMetrics.efficiency.target
                    ? "accent"
                    : "warning"
                }
                minLabel={`${miningMetrics.efficiency.ranges[0] - 2} best`}
                valueLabel={`${miningMetrics.efficiency.value} J/TH`}
                maxLabel={`target ${miningMetrics.efficiency.target} · lower is better`}
                aria-label={`Efficiency ${miningMetrics.efficiency.value} J/TH, target ${miningMetrics.efficiency.target}`}
              />
            </div>
          ) : (
            <EmptySurface
              variant="chart"
              message="Efficiency (J/TH) — awaiting a real telemetry feed."
              detail="No MiningMetric rows exist yet, so no efficiency figure is fabricated."
            />
          )}
        </div>

        {/* ── Act: Reference fleet composition ──────────────────────────── */}
        <TitledDivider
          title="Reference fleet composition"
          trailing={
            <ProvenanceBadge
              kind="manual"
              variant="compact"
              description="Manual — a market catalog of ASIC models available to buy, not an inventory of owned units."
            />
          }
        />
        <div className={SUPPORT}>
          <div className="border-b border-[var(--ct-border-soft)] px-5 py-4">
            <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
              Reference fleet composition — per-unit telemetry pending. This is a
              market catalog of ASIC models and their current cost/efficiency
              profile, not a live inventory of the operation&apos;s owned units.
            </p>
          </div>
          {machineMarket.rows.length > 0 ? (
            <ReferenceFleetTable rows={machineMarket.rows} btcPerThDay={btcPerThDay} />
          ) : (
            <EmptySurface
              message="Reference fleet composition activates once a machine-market snapshot is available."
              detail="No Telegram machine-price snapshot exists yet, so no row is fabricated."
            />
          )}
        </div>

        {/* ── Act: Per-ASIC live telemetry (explicit absence) ──────────── */}
        <TitledDivider title="Per-ASIC live telemetry" />
        <div className={SUPPORT}>
          <EmptySurface
            message="Per-ASIC live telemetry — awaiting fleet integration."
            detail="Temperature · Runtime · Health score · Live status are not tracked per unit anywhere in the schema today. Only fleet-level aggregates (uptime %, efficiency model) exist — this page will never render a fabricated per-unit reading."
          />
        </div>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Mining Operations is an operation-level (fleet-wide) view, not scaled to
          an individual investor&apos;s share. Every figure here is a derived
          estimate under stated assumptions or a market-reference reading — never
          a per-unit measurement — and none of it is guaranteed.
        </p>
      </div>
    </div>
  );
}

/** "13.0 PH/s" → 13000 (TH/s), or null when unparseable. */
function parseHashrateThs(allocatedHashrate: string): number | null {
  const match = /^([\d.]+)\s*PH\/s$/.exec(allocatedHashrate.trim());
  if (!match) return null;
  const ph = Number(match[1]);
  return Number.isFinite(ph) ? ph * 1_000 : null;
}

/**
 * Server-renderable reference table over the machine-market catalog — mirrors
 * `machine-table.tsx`'s column/row structure (dense, token-only Catalyst Table)
 * but drops the client-side sort/filter state: this is a static reference list,
 * not an interactive admin tool, so no "use client" is needed.
 */
function ReferenceFleetTable({
  rows,
  btcPerThDay,
}: {
  rows: readonly MachineRow[];
  btcPerThDay: number;
}) {
  return (
    <Table className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
      <TableHead>
        <TableRow>
          <TableHeader className="bg-transparent ct-bento-label pl-5">Model</TableHeader>
          <TableHeader className="bg-transparent ct-bento-label">Cooling</TableHeader>
          <TableHeader className="bg-transparent ct-bento-label text-right">TH/s</TableHeader>
          <TableHeader className="bg-transparent ct-bento-label text-right">J/TH</TableHeader>
          <TableHeader className="bg-transparent ct-bento-label text-right">
            Est. daily production/unit
          </TableHeader>
          <TableHeader className="bg-transparent ct-bento-label pr-5">Provenance</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => {
          const btcPerUnitPerDay = btcPerThDay > 0 ? r.thPerUnit * btcPerThDay : null;
          return (
            <TableRow key={`${r.model}-${r.thPerUnit}-${i}`} className="border-transparent">
              <TableCell
                className="ct-metric-caption min-w-[12rem] max-w-[20rem] pl-5 font-medium text-[var(--ct-text-strong)]"
                title={r.model}
              >
                <span className="flex items-center gap-2.5">
                  <ManufacturerLogo manufacturer={r.manufacturer} size={20} />
                  <span className="min-w-0 truncate">{r.model}</span>
                </span>
              </TableCell>
              <TableCell className="ct-metric-caption capitalize">{r.cooling}</TableCell>
              <TableCell className="ct-metric-caption text-right tabular-nums text-[var(--ct-text-secondary)]">
                {r.thPerUnit}
              </TableCell>
              <TableCell
                className={
                  r.efficiencyJTh === null
                    ? "ct-metric-caption text-right tabular-nums text-[var(--ct-text-muted)]"
                    : "ct-metric-caption text-right tabular-nums text-[var(--ct-text-secondary)]"
                }
              >
                {r.efficiencyJTh ?? "—"}
              </TableCell>
              <TableCell
                className={
                  btcPerUnitPerDay === null
                    ? "ct-metric-caption text-right tabular-nums text-[var(--ct-text-muted)]"
                    : "ct-metric-caption text-right tabular-nums text-[var(--ct-text-secondary)]"
                }
              >
                {btcPerUnitPerDay === null ? "—" : formatBtc(btcPerUnitPerDay)}
              </TableCell>
              <TableCell className="pr-5">
                <ProvenanceBadge kind="estimated" variant="compact" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
