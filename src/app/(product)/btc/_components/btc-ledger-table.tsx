"use client";

// src/app/(product)/btc/_components/btc-ledger-table.tsx
//
// PROMPT 236 — the Bitcoin LEDGER: the institutional heart of /btc. A real
// register of BTC movements (mining credits, reserve acquisitions, operational
// conversions) and attestations, each row carrying its own evidence link. This
// REPLACES the separate "Contextual proofs" card — proofs are attached per
// event here, never a standalone proof library.
//
// P2.4 register upgrade — rendered on the dedicated /btc/ledger drill-down:
//  - tx hash column: mono truncated + Catalyst copy button (copies the hash);
//  - "Balance after" column: running balance PRE-COMPUTED in the view-model
//    layer (buildBtcLedgerRows fold) — this file only formats it, and rows
//    without the field (or without an anchor) read "—";
//  - grouped rows by month (th scope="colgroup" on a subtle band) + tfoot
//    "Total movements / Net BTC" (TW+ table recipes 14/15);
//  - uppercase micro headers, tracked, muted;
//  - "Verified" badge moved OFF the green success variant to a neutral
//    attested tone — green stays reserved for real Live.
//
// Client component only because the Catalyst <Table> is. No business logic:
// signed BTC deltas are pre-computed in the fixture (deltaSats); this file only
// formats and colours. No red on negatives (vault surface rule) — outflows read
// muted, inflows read BTC-orange.

import { Fragment, useRef, useState } from "react";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import {
  formatBtcAmount,
  formatIsoDate,
  formatPeriodMonth,
  satsToBtcString,
} from "@/features/investor-ui/format-btc";
import type { BtcEventStatus, BtcEventViewModel } from "../_data/btc-page-types";
import Link from "next/link";

/** Accepts both the raw event (/btc compositions, tests) and the enriched
 *  ledger row from `buildBtcLedgerRows` — `balanceAfterSats` is additive. */
type BtcLedgerTableRow = BtcEventViewModel & {
  readonly balanceAfterSats?: string | null;
};

// Attested tone doctrine (P2.4): the single green is reserved for real Live —
// a verified register entry is an ATTESTED fact, not a live signal, so it
// reads neutral-strong ("brand"); confirmed reads neutral-muted ("default").
const STATUS_VARIANT: Record<BtcEventStatus, React.ComponentProps<typeof BentoBadge>["variant"]> = {
  verified: "brand",
  confirmed: "default",
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

/** Running balance sats -> "6.1200 BTC" (4dp register figure). */
function formatBalanceBtc(sats: string): string {
  return formatBtcAmount(satsToBtcString(sats, 8), 4);
}

/** "0x8f2a...c19e" stays as-is; a FULL 66-char hash renders truncated
 *  (copy still carries the full value). */
function truncateHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash;
}

/** "2026-06" -> "Jun 2026" — month group band label. */
function formatPeriodLabel(period: string): string {
  const year = period.split("-")[0] ?? "";
  return `${formatPeriodMonth(period)} ${year}`;
}

const COPY_RESET_MS = 2000;

/** Catalyst copy control for a register tx hash (interactive → primitive). */
function CopyHashButton({ hash, eventLabel }: { hash: string; eventLabel: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hash);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      setCopied(true);
      resetTimerRef.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      // Clipboard API unavailable (non-https / permissions denied) — silent.
    }
  }

  return (
    <CockpitButton
      type="button"
      onClick={handleCopy}
      variant="ghost"
      shape="rect"
      size="sm"
      aria-label={`Copy transaction hash for ${eventLabel}`}
    >
      {copied ? "Copied" : "Copy"}
    </CockpitButton>
  );
}

const COLUMN_COUNT = 8;

export function BtcLedgerTable({
  events,
  provenance = "simulated",
  allAttestationsHref = "/proof-center/full",
}: {
  events: readonly BtcLedgerTableRow[];
  provenance?: Provenance;
  allAttestationsHref?: string;
}) {
  // Month bands — events arrive newest-first (register convention); preserve
  // that order and split on the calendar month. Pure presentation grouping.
  const groups: { period: string; rows: BtcLedgerTableRow[] }[] = [];
  for (const ev of events) {
    const period = ev.occurredAt.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last != null && last.period === period) last.rows.push(ev);
    else groups.push({ period, rows: [ev] });
  }

  // tfoot totals — movements only (attestations never move the balance).
  const movementRows = events.filter((ev) => ev.deltaSats != null);
  const netSats = movementRows.reduce((sum, ev) => sum + Number(ev.deltaSats), 0);
  const netDelta = formatSignedBtc(movementRows.length > 0 ? String(netSats) : null);
  const latestBalanceSats =
    events.find((ev) => ev.balanceAfterSats != null)?.balanceAfterSats ?? null;

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
          <TableHead className="text-xs uppercase tracking-wide">
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Event</TableHeader>
              <TableHeader className="text-right">BTC</TableHeader>
              <TableHeader className="text-right">Balance after</TableHeader>
              <TableHeader>Source</TableHeader>
              <TableHeader>Tx hash</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Evidence</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.period}>
                {/* Month band — subtle register divider (TW+ grouped-rows recipe). */}
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={COLUMN_COUNT}
                    className="border-b border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] px-4 pl-5 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--ct-text-muted)]"
                  >
                    {formatPeriodLabel(group.period)}
                  </th>
                </tr>
                {group.rows.map((ev, i) => {
                  const delta = formatSignedBtc(ev.deltaSats);
                  const balanceAfter = ev.balanceAfterSats ?? null;
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
                      <TableCell className="text-right tabular whitespace-nowrap ct-text-body">
                        {balanceAfter != null ? (
                          formatBalanceBtc(balanceAfter)
                        ) : (
                          <span className="ct-text-faint">—</span>
                        )}
                      </TableCell>
                      <TableCell className="ct-text-body whitespace-nowrap">{ev.source}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {ev.txHash != null ? (
                          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
                            <code className="font-mono text-xs ct-text-muted">{truncateHash(ev.txHash)}</code>
                            <CopyHashButton hash={ev.txHash} eventLabel={ev.label} />
                          </span>
                        ) : (
                          <span className="ct-text-faint">—</span>
                        )}
                      </TableCell>
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
              </Fragment>
            ))}
          </TableBody>
          {/* Register footer — TW+ tfoot totals recipe. Net delta keeps the
              signed tone doctrine (never red); balance column carries the
              latest running balance when an anchor exists. */}
          <tfoot>
            <tr className="border-t border-[var(--ct-border)]">
              <td
                colSpan={2}
                className="px-4 pl-5 py-2.5 text-xs font-medium uppercase tracking-wide text-[var(--ct-text-muted)]"
              >
                Total movements ({movementRows.length}) — net BTC
              </td>
              <td className={`px-4 py-2.5 text-right tabular font-medium whitespace-nowrap ${DELTA_TONE[netDelta.tone]}`}>
                {netDelta.text}
              </td>
              <td className="px-4 py-2.5 text-right tabular whitespace-nowrap ct-text-strong">
                {latestBalanceSats != null ? (
                  formatBalanceBtc(latestBalanceSats)
                ) : (
                  <span className="ct-text-faint">—</span>
                )}
              </td>
              <td colSpan={4} className="px-4 pr-5 py-2.5" />
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}
