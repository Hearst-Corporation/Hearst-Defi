"use client";

// src/app/(product)/btc/_components/btc-ledger-table.tsx
//
// PROMPT 236 — the Bitcoin LEDGER: the institutional heart of /btc. A real
// register of BTC movements (mining credits, reserve acquisitions, operational
// conversions) and attestations, each row carrying its own evidence link. This
// REPLACES the separate "Contextual proofs" card — proofs are attached per
// event here, never a standalone proof library.
//
// Client component only because the Catalyst <Table> is. No business logic:
// signed BTC deltas are pre-computed in the fixture (deltaSats); this file only
// formats and colours. No red on negatives (vault surface rule) — outflows read
// muted, inflows read BTC-orange.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { formatIsoDate } from "@/features/investor-ui/format-btc";
import type { BtcEventStatus, BtcEventViewModel } from "../_data/btc-page-types";
import Link from "next/link";

const STATUS_VARIANT: Record<BtcEventStatus, React.ComponentProps<typeof BentoBadge>["variant"]> = {
  verified: "success",
  confirmed: "accent",
  pending: "warning",
};

const STATUS_LABEL: Record<BtcEventStatus, string> = {
  verified: "Verified",
  confirmed: "Confirmed",
  pending: "Pending",
};

/** sats string (may be signed) -> "+0.517 BTC" / "−0.032 BTC" / "—". Uses a
 *  true minus sign, never a red colour (vault surface: no red). */
function formatSignedBtc(deltaSats: string | null): { text: string; tone: "in" | "out" | "none" } {
  if (deltaSats == null) return { text: "—", tone: "none" };
  const n = Number(deltaSats);
  if (!Number.isFinite(n) || n === 0) return { text: "—", tone: "none" };
  const btc = Math.abs(n) / 1e8;
  const sign = n > 0 ? "+" : "−";
  const tone = n > 0 ? "in" : "out";
  // Never round a real, non-zero movement down to "0" on an institutional
  // ledger — show a sub-precision indicator instead.
  if (btc < 0.000001) return { text: `${sign}<0.000001 BTC`, tone };
  const trimmed = btc.toFixed(6).replace(/\.?0+$/, "");
  return { text: `${sign}${trimmed} BTC`, tone };
}

const DELTA_TONE: Record<"in" | "out" | "none", string> = {
  in: "text-[var(--ct-asset-btc)]",
  out: "ct-text-muted",
  none: "ct-text-faint",
};

export function BtcLedgerTable({
  events,
  provenance = "simulated",
  allAttestationsHref = "/proof-center/full",
}: {
  events: readonly BtcEventViewModel[];
  provenance?: Provenance;
  allAttestationsHref?: string;
}) {
  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)]" material="flat">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="btc" size="sm" />
            <span className="ct-bento-label">Bitcoin ledger</span>
          </div>
          <span className="ct-metric-caption">Every movement that changed the BTC balance, with its evidence.</span>
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <Link href={allAttestationsHref} className="body-xs ct-link-accent whitespace-nowrap">
            View all attestations →
          </Link>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      {events.length === 0 ? (
        <p className="body-sm ct-text-muted m-0">
          Bitcoin movements will appear here once settlements are indexed.
        </p>
      ) : (
        <Table dense className="min-w-0">
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Event</TableHeader>
              <TableHeader className="text-right">BTC</TableHeader>
              <TableHeader>Source</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Evidence</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((ev, i) => {
              const delta = formatSignedBtc(ev.deltaSats);
              return (
                <TableRow key={`${ev.occurredAt}-${i}`}>
                  <TableCell className="ct-text-muted whitespace-nowrap tabular">
                    {formatIsoDate(ev.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <span className="ct-text-strong">{ev.label}</span>
                    {ev.detail ? (
                      <span className="block ct-metric-caption text-[var(--ct-text-muted)]">{ev.detail}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className={`text-right tabular font-medium whitespace-nowrap ${DELTA_TONE[delta.tone]}`}>
                    {delta.text}
                  </TableCell>
                  <TableCell className="ct-text-body whitespace-nowrap">{ev.source}</TableCell>
                  <TableCell>
                    <BentoBadge variant={STATUS_VARIANT[ev.status]}>{STATUS_LABEL[ev.status]}</BentoBadge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {ev.proofHref ? (
                      <Link
                        href={ev.proofHref}
                        className="body-xs ct-link-accent"
                        aria-label={`View evidence for ${ev.label} on ${formatIsoDate(ev.occurredAt)}`}
                      >
                        View
                      </Link>
                    ) : (
                      <span className="ct-text-faint">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
