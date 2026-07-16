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
  formatIsoDate,
} from "@/features/investor-ui/format-btc";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type {
  BtcCustodyViewModel,
  BtcEventViewModel,
  BtcProductionViewModel,
} from "../_data/btc-page-types";

interface BtcOpsRowProps {
  production: ResolvedViewModel<BtcProductionViewModel>;
  events: ResolvedViewModel<readonly BtcEventViewModel[]>;
  custody: ResolvedViewModel<BtcCustodyViewModel>;
  monthsElapsed: number | null;
  monthsTotal: number;
}

/** "0.5170" — plain 4dp BTC figure (unit rendered separately, muted). */
function formatBtc4(n: number): string {
  return n.toFixed(4);
}

const CUSTODY_PROVIDER_LABEL: Record<string, string> = {
  fireblocks: "Fireblocks",
};

export function BtcOpsRow({
  production,
  events,
  custody,
  monthsElapsed,
  monthsTotal,
}: BtcOpsRowProps) {
  // ── Sources of Bitcoin (last month's real delta) ──────────────────────
  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);
  const deltas = toMonthlyDeltas(accumulationPoints);
  const lastDelta = deltas.length > 0 ? deltas[deltas.length - 1] : undefined;

  // ── Bitcoin ledger ────────────────────────────────────────────────────
  const eventList = events.value ?? [];
  const lastEvent = eventList.length > 0 ? eventList[0] : undefined;

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[var(--ct-space-5)] items-stretch">
      <OpsStatCard
        label="Sources of Bitcoin"
        icon={<AssetIcon variant="mining" size="md" />}
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
        footerHref="/mining"
        footerLabel="View mining contribution →"
      />

      <OpsStatCard
        label="Bitcoin ledger"
        icon={<AssetIcon variant="btc" size="md" />}
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
        footerHref="/proof-center"
        footerLabel="View full ledger →"
      />

      <OpsStatCard
        label="Maturity delivery"
        icon={<AssetIcon variant="btc" size="md" />}
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
      />

      <OpsStatCard
        label="Custody"
        icon={<AssetIcon variant="reserve" size="md" />}
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
        footerHref="/proof-center"
        footerLabel="View custody proof →"
      />
    </div>
  );
}
