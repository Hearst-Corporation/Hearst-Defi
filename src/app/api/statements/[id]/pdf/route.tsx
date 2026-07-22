import "server-only";

import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, Svg, Rect, G, StyleSheet } from "@react-pdf/renderer";

import { requireAuth } from "@/lib/auth/require-auth";
import { PDF_DARK } from "@/lib/pdf/pdf-palette";
import { SERIES1_FULL_NAME, series1DisplayName } from "@/lib/vaults/series1";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  PdfProvenance,
  type PdfProvenanceKind,
} from "@/lib/pdf/components/pdf-provenance";
import { assertRateLimit } from "@/lib/rate-limit";
import { formatApyRange } from "@/lib/format/apy";
import {
  aggregateLpPnl,
  daysHeldSince,
} from "@/lib/engine/lp-pnl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max PDF generation requests per user per rate-limit window. */
const PDF_RATE_LIMIT_MAX = 5;
/** Rate-limit window in milliseconds (60 seconds). */
const PDF_RATE_LIMIT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// `pct()` removed with its last two call sites (Net Return and the "% net"
// caption on Total Return) — both rendered engine output driven by the
// never-computed accrual column.

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ytdStart(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

// ---------------------------------------------------------------------------
// Styles (PDF)
// ---------------------------------------------------------------------------

const {
  accent: ACCENT,
  bgDeep: BG_DEEP,
  surface: SURFACE,
  textPrimary: TEXT_PRIMARY,
  textMuted: TEXT_MUTED,
  textFaint: TEXT_FAINT,
  border: BORDER,
} = PDF_DARK;

const styles = StyleSheet.create({
  page: {
    backgroundColor: BG_DEEP,
    color: TEXT_PRIMARY,
    fontFamily: "Helvetica",
    padding: 40,
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    paddingBottom: 16,
    borderBottom: `1 solid ${BORDER}`,
  },
  headerLeft: {
    flexDirection: "column",
    gap: 4,
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  logoText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
  },
  logoAccent: {
    color: ACCENT,
  },
  tagline: {
    fontSize: 8,
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statementTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  statementMeta: {
    fontSize: 8,
    color: TEXT_MUTED,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1 solid ${BORDER}`,
  },
  table: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: `1 solid ${BORDER}`,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: `1 solid ${BORDER}`,
    backgroundColor: SURFACE,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: `1 solid ${TEXT_FAINT}`,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
  },
  tableHeaderCellRight: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
    textAlign: "right",
  },
  cell: {
    fontSize: 9,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  cellRight: {
    fontSize: 9,
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: "right",
  },
  cellMuted: {
    fontSize: 9,
    color: TEXT_MUTED,
    flex: 1,
  },
  cellAccent: {
    fontSize: 9,
    color: ACCENT,
    flex: 1,
    textAlign: "right",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: SURFACE,
    borderRadius: 4,
    border: `1 solid ${BORDER}`,
    padding: 10,
    flex: 1,
    minWidth: 110,
  },
  summaryLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEXT_PRIMARY,
  },
  summaryValueAccent: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
  },
  summaryUnit: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  disclaimer: {
    marginTop: 28,
    paddingTop: 12,
    borderTop: `1 solid ${BORDER}`,
    fontSize: 7,
    color: TEXT_MUTED,
    lineHeight: 1.5,
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: TEXT_FAINT,
  },
  provenanceWrap: {
    marginTop: 4,
  },
  cellProvenance: {
    flex: 0.7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pnlSubtitle: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 8,
    fontStyle: "italic",
  },
  /**
   * Value slot for a metric the platform does not compute. Rendered muted and
   * at a smaller size than `summaryValue` so it never reads as a headline
   * number — an investor must not mistake it for a measured $0.00.
   */
  summaryValueUnavailable: {
    fontSize: 11,
    fontFamily: "Helvetica",
    color: TEXT_MUTED,
  },
});

/** Printed in place of any figure derived from the never-computed accrual column. */
const NOT_CALCULATED = "Not calculated";

// ---------------------------------------------------------------------------
// Logo SVG inline (Hearst Connect wordmark as path)
// ---------------------------------------------------------------------------

function LogoSvg() {
  return (
    <Svg width="120" height="28" viewBox="0 0 120 28">
      {/* Background pill */}
      <Rect x="0" y="0" width="120" height="28" rx="4" fill={SURFACE} />
      {/* "H" mark */}
      <G transform="translate(8, 5)">
        <Rect x="0" y="0" width="3" height="18" fill={ACCENT} />
        <Rect x="0" y="7.5" width="9" height="3" fill={ACCENT} />
        <Rect x="6" y="0" width="3" height="18" fill={ACCENT} />
      </G>
      {/* "HEARST CONNECT" text */}
      <Text
        style={{ fontSize: 9, fontFamily: "Helvetica-Bold", fill: TEXT_PRIMARY, letterSpacing: 1 }}
        x="26"
        y="12"
      >
        HEARST
      </Text>
      <Text
        style={{ fontSize: 7, fontFamily: "Helvetica", fill: TEXT_MUTED, letterSpacing: 0.8 }}
        x="26"
        y="22"
      >
        CONNECT
      </Text>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------

/**
 * Per-metric provenance map.
 *
 * The route is the authoritative place to map each printed metric back to
 * the system that produced it — the data sources are heterogeneous (DB
 * `Position`, DB `InvestorTransaction`, DB `VaultDeployment`, pure engine
 * `aggregateLpPnl`) so we cannot rely on a single flag.
 *
 * ACCRUED YIELD IS NOT PRINTED IN THIS STATEMENT.
 *
 * The previous mapping described `Position.accruedYieldUsdc` as "refreshed by a
 * cron from snapshots -> estimated (model output)". That is not true: no business
 * process ever writes that column. Its only writers are the demo fixtures in
 * `src/lib/demo/`, so on a production record it holds its Prisma `@default(0)`.
 * Series 1 is moreover a BTC-ACCUMULATION note that pays no yield — the
 * `/portfolio/yield` and `/portfolio/distributions` surfaces are retired
 * redirects. Printing that column in an investor-facing statement published an
 * uncomputed default as a measured accrual, and contaminated every figure
 * derived from it (total value, yield YTD, current value, unrealized, total
 * return, net return). Those figures are now either principal-only or marked as
 * not calculated. Realized cash from the ledger is unaffected and still printed.
 *
 * Source mapping rationale:
 *   - Principal           : DB `Position.principalUsdc` set at subscription
 *                           confirmation -> attested (on-chain tx)
 *   - Accrued yield       : NOT CALCULATED — column never written (see above)
 *   - Distributed         : DB `Position.distributedUsdc` (cumulative paid)
 *                           -> attested
 *   - APY range           : `VaultDeployment.targetApyLowBps/HighBps`,
 *                           published target -> estimated (forward-looking)
 *   - Total value         : sum of principals only -> attested
 *   - Yield YTD           : YTD ledger distributions only -> attested
 *   - Net return / annual : NOT CALCULATED — was driven by accrued
 *   - Cost basis          : sum of principals -> attested
 *   - Current value       : principal (no accrual to add) -> attested
 *   - Unrealized          : NOT CALCULATED — accrual not computed
 *   - Realized            : sum of distributed -> attested
 *   - Total return        : realized cash only -> attested
 *   - Distribution rows   : DB ledger -> attested (paid) | estimated (scheduled)
 */
interface PositionRow {
  id: string;
  vaultName: string;
  vaultTicker: string;
  status: string;
  principalUsdc: number;
  // No `accruedYieldUsdc`: the column is never computed, so it is deliberately
  // not carried into the statement model at all (see the note above).
  distributedUsdc: number;
  apyLow: number;
  apyHigh: number;
  subscribedAt: Date;
  daysHeld: number;
}

interface DistributionRow {
  id: string;
  period: string;
  amountUsdc: number;
  occurredAt: Date;
  type: string;
  /**
   * `attested` once the entry has been recorded as paid in the ledger
   * (`type: "distribution"`), `estimated` while still scheduled.
   */
  provenance: PdfProvenanceKind;
}

interface StatementData {
  investorId: string;
  investorEmail: string | null;
  generatedAt: Date;
  positions: PositionRow[];
  ytdDistributions: DistributionRow[];
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
}

function StatementDocument({ data }: { data: StatementData }) {
  const monthLabel = data.generatedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  // `accruedYieldUsdc: 0` is intentional, not an omission. The engine's
  // "unrealized" leg is exactly the accrual column, which nothing computes; the
  // statement therefore reports the engine's REALIZED figures (cost basis,
  // realized cash) and marks the unrealized-derived ones as not calculated,
  // instead of publishing an uncomputed default as an unrealized gain.
  const aggregatePnl = aggregateLpPnl(
    data.positions.map((p) => ({
      contributedUsdc: p.principalUsdc,
      distributedUsdc: p.distributedUsdc,
      accruedYieldUsdc: 0,
      daysHeld: p.daysHeld,
    })),
  );

  // Est. return range in percent (default: 9.4–12.8%). Uses the first position's
  // data; all positions in a single-vault statement share the same target range.
  const apyRangeLabel = formatApyRange({
    low: data.positions[0]?.apyLow ?? 9.4,
    high: data.positions[0]?.apyHigh ?? 12.8,
  });

  return (
    <Document
      title={`Hearst Connect — LP Statement ${monthLabel}`}
      author="Hearst Connect"
      creator="Hearst Connect Platform"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LogoSvg />
            <Text style={[styles.tagline, { marginTop: 6 }]}>
              {/* Canon, not the retired "Yield Vault" name: this tagline sits
                  on every investor statement. */}
              Institutional Bitcoin mining note · {SERIES1_FULL_NAME}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.statementTitle}>LP Statement</Text>
            <Text style={styles.statementMeta}>{monthLabel}</Text>
            <Text style={styles.statementMeta}>
              Generated: {fmtDate(data.generatedAt)}
            </Text>
            {data.investorEmail && (
              <Text style={[styles.statementMeta, { marginTop: 4 }]}>
                {data.investorEmail}
              </Text>
            )}
          </View>
        </View>

        {/* ── Summary KPIs ──────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Portfolio Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            {/* Deposited principal only — no accrual is added (see note above). */}
            <Text style={styles.summaryValue}>{usd(data.totalValueUsdc)}</Text>
            <Text style={styles.summaryUnit}>Deposited principal</Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" hint="principal" />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Distributions YTD</Text>
            {/* Renamed from "Yield YTD": the figure is now strictly cash recorded
                in the ledger this year, with no accrual term added. */}
            <Text style={styles.summaryValueAccent}>
              {usd(data.totalYieldYtdUsdc)}
            </Text>
            <Text style={styles.summaryUnit}>
              Cash recorded · {data.generatedAt.getUTCFullYear()}
            </Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" hint="ledger" />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Return</Text>
            {/* The engine's net return is driven by the unrealized (accrual) leg,
                which nothing computes. Printing its output would state a measured
                return. Marked unavailable rather than shown as 0.00%. */}
            <Text style={styles.summaryValueUnavailable}>{NOT_CALCULATED}</Text>
            <Text style={styles.summaryUnit}>
              No valuation source for this note
            </Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="manual" hint="not computed" />
            </View>
          </View>

          {/* Target range is a published forward-looking figure, independent of
              the accrual column, so it is still printed. The annualisation line
              is dropped: it rescaled the same non-computed net return. */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Est. Return (Target)</Text>
            <Text style={styles.summaryValue}>{apyRangeLabel}</Text>
            <Text style={styles.summaryUnit}>
              Published target · not a realized figure
            </Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="estimated" hint="target range" />
            </View>
          </View>
        </View>

        {/* ── Positions ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Positions</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Vault</Text>
            <Text style={styles.tableHeaderCell}>Status</Text>
            <Text style={styles.tableHeaderCellRight}>Principal</Text>
            {/* "Accrued Yield" column removed — the value it printed came from a
                column no process computes, and this note accrues no yield. */}
            <Text style={styles.tableHeaderCellRight}>Distributed</Text>
            <Text style={styles.tableHeaderCellRight}>Est. Return</Text>
            <Text style={styles.tableHeaderCellRight}>Since</Text>
            <Text style={styles.tableHeaderCellRight}>Source</Text>
          </View>
          {data.positions.map((p, i) => (
            <View
              key={p.id}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.cell, { flex: 2 }]}>{p.vaultName}</Text>
              <Text style={styles.cellMuted}>{p.status}</Text>
              {/* principal = attested (on-chain subscription) */}
              <Text style={styles.cellRight}>{usd(p.principalUsdc)}</Text>
              {/* distributed = attested (cumulative paid in USDC) */}
              <Text style={styles.cellRight}>{usd(p.distributedUsdc)}</Text>
              {/* Est. return range = estimated (published vault target) */}
              <Text style={styles.cellAccent}>
                {p.apyLow}–{p.apyHigh}%
              </Text>
              <Text style={styles.cellMuted}>{fmtDate(p.subscribedAt)}</Text>
              {/* Still `partial`: attested principal/distributed alongside the
                  forward-looking target return range. */}
              <View style={styles.cellProvenance}>
                <PdfProvenance kind="partial" />
              </View>
            </View>
          ))}
        </View>

        {/* ── P&L ───────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>P&L Analysis</Text>
        <Text style={styles.pnlSubtitle}>
          Cost basis and realized cash across all positions. Unrealized gain and
          net return are not calculated: this note accrues no yield and the
          platform runs no valuation process for it.
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Cost Basis</Text>
            <Text style={styles.summaryValue}>
              {usd(aggregatePnl.contributedUsdc)}
            </Text>
            <Text style={styles.summaryUnit}>Total contributed</Text>
            {/* sum of attested principals */}
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" />
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Current Value</Text>
            {/* With no accrual leg this equals the contributed principal, which
                is attested — no longer a "partial" principal + accrued mix. */}
            <Text style={styles.summaryValue}>
              {usd(aggregatePnl.currentValueUsdc)}
            </Text>
            <Text style={styles.summaryUnit}>Principal deployed</Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" />
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Unrealized</Text>
            {/* This card printed `Position.accruedYieldUsdc` verbatim — the
                never-computed column — labelled "Accrued, not yet paid". That is
                the single most misleading line of the statement, so it now states
                that no such figure is produced. */}
            <Text style={styles.summaryValueUnavailable}>{NOT_CALCULATED}</Text>
            <Text style={styles.summaryUnit}>No accrual is computed</Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="manual" hint="not computed" />
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Realized</Text>
            <Text style={styles.summaryValueAccent}>
              {usd(aggregatePnl.realizedUsdc)}
            </Text>
            <Text style={styles.summaryUnit}>Cash received</Text>
            {/* sum of paid distributions */}
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" />
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Return</Text>
            {/* Realized cash only (the unrealized leg is 0 by the decision above),
                so this is attested. The "% net" caption is dropped — it was the
                engine's net return, driven by the non-computed accrual. */}
            <Text style={styles.summaryValueAccent}>
              {usd(aggregatePnl.totalReturnUsdc)}
            </Text>
            <Text style={styles.summaryUnit}>Realized cash only</Text>
            <View style={styles.provenanceWrap}>
              <PdfProvenance kind="attested" />
            </View>
          </View>
        </View>

        {/* ── Distributions YTD ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>
          Distributions YTD ({data.generatedAt.getUTCFullYear()})
        </Text>
        {data.ytdDistributions.length === 0 ? (
          <Text style={styles.cellMuted}>
            No distributions recorded yet this year.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHeaderCell}>Date</Text>
              <Text style={styles.tableHeaderCell}>Type</Text>
              <Text style={styles.tableHeaderCellRight}>Amount</Text>
              <Text style={styles.tableHeaderCellRight}>Source</Text>
            </View>
            {data.ytdDistributions.map((tx, i) => (
              <View
                key={tx.id}
                style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={styles.cellMuted}>{fmtDate(tx.occurredAt)}</Text>
                <Text style={styles.cell}>{tx.type}</Text>
                {/* amount is recorded in the ledger -> attested when paid,
                    estimated while still scheduled (see DistributionRow). */}
                <Text style={styles.cellAccent}>{usd(tx.amountUsdc)}</Text>
                <View style={styles.cellProvenance}>
                  <PdfProvenance kind={tx.provenance} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer disclaimer ─────────────────────────────────────────── */}
        <Text style={styles.disclaimer}>
          Projections — not guaranteed. The estimated target return range
          ({apyRangeLabel}) is expressed in accumulated BTC over the term, based
          on stated assumptions and Methodology v3.0; it is not a distributed
          cash yield and is not a commitment of future returns. Lines marked
          &quot;Not calculated&quot; are figures this platform does not produce for
          this note — no accrued-yield or valuation process runs against it — and
          must not be read as a nil result. Past
          performance does not predict future results. Hearst Connect is a
          Cayman SPV mining-backed note that accumulates BTC over a 24-month
          term with rule-based take-profit; there is no periodic cash
          distribution. $250,000 minimum ticket size and a 60-day soft lock-up
          apply contractually (not enforced on-chain). This document is provided
          for informational purposes only and does not constitute investment
          advice, solicitation or an offer to buy or sell any security. Eligible
          investors only.
        </Text>

        <View style={styles.footer}>
          <Text>Hearst Connect · connect.hearst.app · {fmtDate(data.generatedAt)}</Text>
          <Text>Confidential · For eligible investors only</Text>
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/statements/[id]/pdf
 *
 * Generates a deterministic LP statement PDF for the authenticated investor.
 *
 * The `id` parameter is the investor's DB id (cuid). A 404 is returned when
 * the requested id does not belong to the authenticated user (ownership check).
 *
 * Auth   : DB-backed session via `requireAuth()` (hc_session cookie). 401 otherwise.
 * Limit  : 5 downloads / 60s / userId (PDF generation is compute-intensive).
 * Response: application/pdf with Content-Disposition: attachment.
 */
export async function GET(
  _req: Request,
  { params }: RouteParams,
): Promise<Response> {
  // 1. Auth gate — must precede any DB access.
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch (err) {
    logger.warn(
      "statements.pdf.auth_rejected",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // 2. Rate limit — PDF generation is compute-intensive.
  try {
    await assertRateLimit(`statements-pdf:${userId}`, PDF_RATE_LIMIT_MAX, PDF_RATE_LIMIT_WINDOW_MS);
  } catch (err) {
    logger.warn(
      "statements.pdf.rate_limited",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 3. Resolve the `id` param (Next.js 15+ async params).
  const { id } = await params;

  // 4. Ownership check — the id must belong to the authenticated user's investor.
  const investor = await prisma.investor.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });

  if (!investor || investor.userId !== userId) {
    logger.warn("statements.pdf.not_found", { userId, requestedId: id });
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  logger.info("statements.pdf.start", { userId, investorId: id });

  // 5. Fetch data — positions + YTD distributions in parallel.
  const now = new Date();
  const [rawPositions, ytdTxs] = await Promise.all([
    prisma.position.findMany({
      where: { investorId: investor.id },
      include: { vaultDeployment: true },
      orderBy: { subscribedAt: "desc" },
      take: 100,
    }),
    prisma.investorTransaction.findMany({
      where: {
        investorId: investor.id,
        type: { in: ["claim", "distribution"] },
        occurredAt: { gte: ytdStart() },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
  ]);

  const positions = rawPositions.map((p) => {
    const principal = toNumber(p.principalUsdc);
    const distributed = toNumber(p.distributedUsdc);
    const apyLowBps = p.vaultDeployment?.targetApyLowBps ?? 940;
    const apyHighBps = p.vaultDeployment?.targetApyHighBps ?? 1280;

    return {
      id: p.id,
      // series1DisplayName remaps retired stored names ("Hearst Yield Vault")
      // and absences onto the Series 1 canon — the same read boundary the
      // cockpit already uses, now applied to the statement PDF.
      vaultName: series1DisplayName(p.vaultDeployment?.name),
      vaultTicker: p.vaultDeployment?.ticker ?? "HYV-A",
      status: p.status,
      principalUsdc: principal,
      distributedUsdc: distributed,
      apyLow: Math.round((apyLowBps / 100) * 10) / 10,
      apyHigh: Math.round((apyHighBps / 100) * 10) / 10,
      subscribedAt: p.subscribedAt,
      daysHeld: daysHeldSince(p.subscribedAt, now),
    };
  });

  // Total value = deposited principal only. Adding `accruedYieldUsdc` (never
  // computed — see the provenance note above) inflated the headline with an
  // uncomputed default presented as portfolio value.
  const totalValueUsdc = positions.reduce((sum, p) => sum + p.principalUsdc, 0);

  // YTD yield = cash actually recorded in the ledger this year. The former
  // "+ accrued across all positions" term added a non-computed column to a
  // figure the investor reads as income received.
  const totalYieldYtdUsdc = ytdTxs.reduce(
    (sum, t) => sum + toNumber(t.amountUsdc),
    0,
  );

  const ytdDistributions: DistributionRow[] = ytdTxs.map((t) => ({
    id: t.id,
    period: t.occurredAt.toISOString().slice(0, 7),
    amountUsdc: toNumber(t.amountUsdc),
    occurredAt: t.occurredAt,
    type: t.type,
    // Paid distributions (type === "distribution" | "claim") sit in the
    // ledger with an executed transfer -> attested. Anything else (rare
    // placeholder statuses) is still a projection -> estimated.
    provenance:
      t.type === "distribution" || t.type === "claim"
        ? "attested"
        : "estimated",
  }));

  // 6. Build statement data.
  const statementData: StatementData = {
    investorId: investor.id,
    investorEmail: investor.user?.email ?? null,
    generatedAt: now,
    positions,
    ytdDistributions,
    totalValueUsdc,
    totalYieldYtdUsdc,
  };

  // 7. Render PDF.
  let pdfBytes: Uint8Array;
  try {
    const rendered = await renderToBuffer(
      <StatementDocument data={statementData} />,
    );
    // renderToBuffer resolves to a Node.js Buffer (subclass of Uint8Array).
    // Wrapping in Uint8Array makes it compatible with the Web Fetch Response API.
    pdfBytes = new Uint8Array(rendered);
  } catch (err) {
    logger.error(
      "statements.pdf.render_failed",
      { userId, investorId: id },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const filename = `hearst-statement-${now.toISOString().slice(0, 7)}.pdf`;

  logger.info("statements.pdf.success", {
    userId,
    investorId: id,
    sizeBytes: pdfBytes.length,
  });

  return new Response(new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
