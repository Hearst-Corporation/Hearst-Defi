// src/app/(product)/btc/_components/btc-ops-row.tsx
//
// BtcOpsRow — the /btc Zone 3 stat band. Four OpsStatCard instances sharing
// the dashboard's uniform gabarit (header / dominant value / detail / media /
// footer) so the row reads level:
//   Sources of Bitcoin · Bitcoin ledger · Maturity delivery · Custody.
//
// The gabarit is IMPORTED from the dashboard (never duplicated) — one card
// skeleton across surfaces. Tonality is BTC-orange (var(--ct-asset-btc)); no
// green accent on values, no glow, no box-shadow.
//
// Honesty: every figure maps 1:1 to a view-model field; provenance per card
// via toProvenance; an unresolved block renders "—" with its honest detail
// line — no fabricated fallback.

import { OpsStatCard } from "@/app/(product)/dashboard/_components/ops-stat-card";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import {
  buildAccumulationSeries,
  toMonthlyDeltas,
} from "@/features/investor-ui/charts/accumulation-series";
import {
  toProvenance,
  formatBtcAmount,
  satsToBtcString,
  formatIsoDate,
} from "@/features/investor-ui/format-btc";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BitcoinReserveViewModel } from "@/features/investor-ui/types/btc";
import type {
  BtcCustodyViewModel,
  BtcEventViewModel,
  BtcProductionViewModel,
} from "../_data/btc-page-types";

interface BtcOpsRowProps {
  production: ResolvedViewModel<BtcProductionViewModel>;
  events: ResolvedViewModel<readonly BtcEventViewModel[]>;
  custody: ResolvedViewModel<BtcCustodyViewModel>;
  reserve: ResolvedViewModel<BitcoinReserveViewModel>;
  monthsElapsed: number | null;
  monthsTotal: number;
  /** DataStatus of the mining block backing the Month x/y figure — the
   *  Maturity card's dominant value comes from mining, not custody, so it
   *  carries the mining provenance (dashboard convention: badge = the block
   *  behind the dominant figure). */
  miningStatus: string;
}

/** "0.5170" — plain 4dp BTC figure (unit rendered separately, muted). */
function formatBtc4(n: number): string {
  return n.toFixed(4);
}

/** Signed sats string -> "+0.517 BTC" / "−0.032 BTC" for the ledger media
 *  line. Mirrors the ledger table's convention: true minus sign, never red. */
function formatSignedBtcDelta(deltaSats: string | null): string | null {
  if (deltaSats == null) return null;
  const n = Number(deltaSats);
  if (!Number.isFinite(n) || n === 0) return null;
  const btc = Math.abs(n) / 1e8;
  const sign = n > 0 ? "+" : "−";
  if (btc < 0.000001) return `${sign}<0.000001 BTC`;
  return `${sign}${btc.toFixed(6).replace(/\.?0+$/, "")} BTC`;
}

const CUSTODY_PROVIDER_LABEL: Record<string, string> = {
  fireblocks: "Fireblocks",
};

export function BtcOpsRow({
  production,
  events,
  custody,
  reserve,
  monthsElapsed,
  monthsTotal,
  miningStatus,
}: BtcOpsRowProps) {
  // ── Sources of Bitcoin (last month's real delta) ──────────────────────
  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);
  const deltas = toMonthlyDeltas(accumulationPoints);
  const lastDelta = deltas.length > 0 ? deltas[deltas.length - 1] : undefined;

  // ── Bitcoin ledger ────────────────────────────────────────────────────
  const eventList = events.value ?? [];
  const lastEvent = eventList.length > 0 ? eventList[0] : undefined;
  const lastEventDelta = formatSignedBtcDelta(lastEvent?.deltaSats ?? null);

  // ── Maturity delivery ─────────────────────────────────────────────────
  const termPct =
    monthsElapsed != null && monthsTotal > 0
      ? Math.min(100, Math.max(0, (monthsElapsed / monthsTotal) * 100))
      : null;

  // ── Custody ───────────────────────────────────────────────────────────
  const c = custody.value;
  const providerName =
    c?.provider != null && c.provider !== "unknown"
      ? (CUSTODY_PROVIDER_LABEL[c.provider] ?? c.provider)
      : null;
  const attestedAt = c?.proofOfReserveAttestedAt ?? null;
  const reserveBtc =
    reserve.value?.reserveBtcSats != null
      ? formatBtcAmount(satsToBtcString(reserve.value.reserveBtcSats, 8), 2)
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[var(--ct-space-5)] items-stretch">
      <OpsStatCard
        label="Sources of Bitcoin"
        icon={<AssetIcon variant="mining" size="sm" />}
        provenance={toProvenance(production.status)}
        value={
          <span className="text-[var(--ct-asset-btc)] text-[length:var(--ct-text-2xl)] font-medium tabular">
            {lastDelta != null ? `${formatBtc4(lastDelta.totalBtc)} BTC` : "—"}
          </span>
        }
        detail={
          lastDelta != null
            ? "Mining credits + reserve acquisitions"
            : "Production data not configured"
        }
        media={
          lastDelta != null ? (
            <div className="grid grid-cols-2 gap-[var(--ct-space-3)] body-xs">
              <span className="flex items-center justify-between gap-[var(--ct-space-2)] min-w-0">
                <span className="ct-text-muted truncate">Mining</span>
                <span className="ct-text-strong font-medium tabular">
                  {formatBtc4(lastDelta.miningBtc)}
                </span>
              </span>
              <span className="flex items-center justify-between gap-[var(--ct-space-2)] min-w-0">
                <span className="ct-text-muted truncate">Reserve</span>
                <span className="ct-text-strong font-medium tabular">
                  {formatBtc4(lastDelta.strategicBtc)}
                </span>
              </span>
            </div>
          ) : undefined
        }
        footerHref="/mining"
        footerLabel="View mining contribution →"
        footerMeta={lastDelta != null ? lastDelta.period : undefined}
      />

      <OpsStatCard
        label="Bitcoin ledger"
        icon={<AssetIcon variant="btc" size="sm" />}
        provenance={toProvenance(events.status)}
        value={
          <span className="ct-text-strong text-[length:var(--ct-text-2xl)] font-medium tabular">
            {eventList.length}{" "}
            <span className="ct-text-muted text-[length:var(--ct-text-base)] font-normal">
              movements
            </span>
          </span>
        }
        detail={
          lastEvent != null
            ? `${lastEvent.label} — ${formatIsoDate(lastEvent.occurredAt)}`
            : "No movements indexed yet"
        }
        media={
          lastEvent != null ? (
            <div className="flex items-center justify-between body-xs">
              <span className="ct-text-muted truncate">Last movement</span>
              <span className="text-[var(--ct-asset-btc)] font-medium tabular whitespace-nowrap">
                {lastEventDelta ?? "—"}
              </span>
            </div>
          ) : undefined
        }
        footerHref="/proof-center"
        footerLabel="View full ledger →"
        footerMeta={lastEvent != null ? formatIsoDate(lastEvent.occurredAt) : undefined}
      />

      <OpsStatCard
        label="Maturity delivery"
        icon={<AssetIcon variant="btc" size="sm" />}
        provenance={toProvenance(miningStatus)}
        value={
          <span className="ct-text-strong text-[length:var(--ct-text-2xl)] font-medium">
            {monthsElapsed != null ? (
              <>
                Month{" "}
                <span className="text-[var(--ct-asset-btc)] tabular">{monthsElapsed}</span>{" "}
                <span className="ct-text-muted text-[length:var(--ct-text-base)] font-normal">
                  / {monthsTotal}
                </span>
              </>
            ) : (
              "—"
            )}
          </span>
        }
        detail="BTC delivered at maturity — not guaranteed"
        media={
          termPct != null ? (
            // Decorative bar — "Month x / y" value + "n months remaining"
            // footer meta already carry the same info for screen readers.
            <div
              aria-hidden="true"
              className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,#ffffff_8%,transparent)]"
            >
              <div
                className="h-full rounded-full bg-[var(--ct-asset-btc)]"
                style={{ width: `${termPct}%` }}
              />
            </div>
          ) : undefined
        }
        footerHref="/proof-center"
        footerLabel="View delivery terms →"
        footerMeta={
          monthsElapsed != null ? `${Math.max(0, monthsTotal - monthsElapsed)} months remaining` : undefined
        }
      />

      <OpsStatCard
        label="Custody"
        icon={<AssetIcon variant="reserve" size="sm" />}
        provenance={toProvenance(custody.status)}
        value={
          <span className="ct-text-strong text-[length:var(--ct-text-2xl)] font-medium">
            {providerName ?? "—"}
          </span>
        }
        detail={
          providerName != null
            ? c?.vaultAccountId != null
              ? `Vault account ${c.vaultAccountId} · ${
                  attestedAt != null ? `attested ${formatIsoDate(attestedAt)}` : "attestation pending"
                }`
              : attestedAt != null
                ? `Attested ${formatIsoDate(attestedAt)}`
                : "Attestation pending"
            : // Unresolved block: surface the block's own honest freshness line
              // when it carries one (e.g. PARTIAL "linked, attestation pending")
              // instead of overstating "not yet linked".
              (custody.freshness ?? "Custody provider not yet linked")
        }
        media={
          reserveBtc != null ? (
            <div className="flex items-center justify-between body-xs">
              <span className="ct-text-muted flex items-center gap-1">
                <AssetIcon variant="btc" size="sm" label="" />
                Reserve BTC
              </span>
              <span className="text-[var(--ct-asset-btc)] font-medium tabular">{reserveBtc}</span>
            </div>
          ) : undefined
        }
        footerHref="/proof-center"
        footerLabel="View custody proof →"
        footerMeta={attestedAt != null ? formatIsoDate(attestedAt) : undefined}
      />
    </div>
  );
}
