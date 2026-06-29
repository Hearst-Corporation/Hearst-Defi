/**
 * Construction report PDF — admin endpoint.
 *
 * Renders a ProductConstructionDraft into a downloadable PDF using the same
 * @react-pdf/renderer engine as the statements route. Admin-only, rate-limited.
 * Read-only: it renders the draft the client already holds; it persists nothing
 * and performs no send/deploy. APY stays a range; the document carries the
 * "not guaranteed" disclaimer.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: "#11160f",
    fontFamily: "Helvetica",
  },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  objective: { fontSize: 11, color: "#3a3f36", marginBottom: 16 },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d8ddd2",
    paddingBottom: 3,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  stat: {
    width: "23%",
    borderWidth: 1,
    borderColor: "#d8ddd2",
    borderRadius: 4,
    padding: 6,
  },
  statLabel: { fontSize: 7, color: "#6b7363", textTransform: "uppercase" },
  statValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  para: { fontSize: 10, lineHeight: 1.5, marginBottom: 4, color: "#2a2f26" },
  bullet: { fontSize: 9, lineHeight: 1.4, marginBottom: 2, color: "#2a2f26" },
  disclaimer: {
    fontSize: 8,
    color: "#6b7363",
    marginTop: 14,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#9aa291",
    textAlign: "center",
  },
});

function pct(n: number, d = 1): string {
  return `${(n * 100).toFixed(d)}%`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ReportDocument({ draft }: { draft: ProductConstructionDraft }) {
  // Plain-text prose (strip markdown headings/bullets for the PDF body).
  const proseLines = draft.writeup.prose
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "• ").trim())
    .filter((l) => l.length > 0);

  return (
    <Document title={`${draft.vault.label} — construction report`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{draft.vault.label} — construction report</Text>
        <Text style={styles.objective}>{draft.objective}</Text>

        <Text style={styles.h2}>Summary</Text>
        <View style={styles.row}>
          <Stat
            label="Headline APY"
            value={`${pct(draft.quant.headlineRange.low)}–${pct(draft.quant.headlineRange.high)}`}
          />
          <Stat label="Vault" value={draft.vault.ticker} />
          <Stat
            label="P(below floor)"
            value={`${draft.quant.probBelowFloorPct}%`}
          />
          <Stat label="Machines" value={String(draft.telegram.machineCount)} />
        </View>

        <Text style={styles.h2}>Market inputs</Text>
        <View style={styles.row}>
          <Stat
            label="BTC spot"
            value={`$${Math.round(draft.market.btcUsd).toLocaleString("en-US")}`}
          />
          <Stat
            label="Hashprice"
            value={`$${draft.market.hashpriceUsdPerThDay.toFixed(3)}/TH`}
          />
          <Stat
            label="DeFi USDC"
            value={`${draft.market.defiApyMedianPct.toFixed(2)}%`}
          />
          <Stat label="Top machine" value={draft.telegram.topMachine ?? "—"} />
        </View>

        <Text style={styles.h2}>Projection (Monte-Carlo)</Text>
        <View style={styles.row}>
          <Stat label="p5" value={pct(draft.quant.percentiles.p5)} />
          <Stat label="p25" value={pct(draft.quant.percentiles.p25)} />
          <Stat label="p50" value={pct(draft.quant.percentiles.p50)} />
          <Stat label="p75" value={pct(draft.quant.percentiles.p75)} />
        </View>
        <View style={styles.row}>
          <Stat label="p95" value={pct(draft.quant.percentiles.p95)} />
          <Stat label="Seed" value={String(draft.quant.seed)} />
          <Stat label="Paths" value={String(draft.assumptions.paths)} />
          <Stat
            label="Horizon"
            value={`${draft.assumptions.horizonMonths} mo`}
          />
        </View>

        <Text style={styles.h2}>Assumptions</Text>
        {draft.strategy.assumptions.map((a, i) => (
          <Text key={i} style={styles.bullet}>
            • {a}
          </Text>
        ))}

        <Text style={styles.h2}>Write-up</Text>
        {proseLines.map((l, i) => (
          <Text key={i} style={styles.para}>
            {l}
          </Text>
        ))}

        <Text style={styles.disclaimer}>{draft.disclaimer}</Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Hearst Connect · construction report · read-only draft · not guaranteed · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/** Minimal runtime validation that the body looks like a construction draft. */
function isDraftLike(v: unknown): v is ProductConstructionDraft {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.objective === "string" &&
    typeof d.vault === "object" &&
    typeof d.quant === "object" &&
    typeof d.market === "object" &&
    typeof d.writeup === "object"
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = (await requireAdmin()).userId;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message
      .toLowerCase()
      .includes("authentication required");
    return NextResponse.json(
      { error: message },
      { status: isAuthRequired ? 401 : 403 },
    );
  }

  try {
    await assertBodySize(request);
    await assertRateLimit(
      `admin-construction-pdf:${userId}`,
      RATE_MAX,
      RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  let draft: ProductConstructionDraft;
  try {
    const body = (await request.json().catch(() => null)) as {
      draft?: unknown;
    } | null;
    if (!body || !isDraftLike(body.draft)) {
      return NextResponse.json(
        { error: "A construction draft is required" },
        { status: 400 },
      );
    }
    draft = body.draft;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const pdf = await renderToBuffer(<ReportDocument draft={draft} />);
    return new Response(
      new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${draft.vault.ticker}-construction-report.pdf"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    logger.warn(
      "construction report pdf failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "PDF render failed" }, { status: 500 });
  }
}
