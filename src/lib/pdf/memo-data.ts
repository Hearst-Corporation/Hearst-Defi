import "server-only";

import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import {
  loadMiningOpsSnapshot,
  type MiningOpsSnapshot,
} from "@/lib/agents/loaders/mining";
import {
  loadVaultMonthlyHistory,
  type VaultMonthlyRow,
} from "@/lib/agents/loaders/vault";
import type { InvestorMemoOutput, ProvenanceTag } from "@/lib/agents/schemas";
import type { PdfProvenanceKind } from "@/lib/pdf/components/pdf-provenance";

/**
 * Combined payload passed to the PDF template. The PDF needs both:
 *  - The structured engine input (`InvestorMemoInput`) — numbers, allocations,
 *    backtests, BTC tactical state. The PDF is driven from these so its
 *    tables/charts stay faithful to the engine, not a paraphrased model output.
 *  - The Opus-generated Markdown sections — used only where prose is needed
 *    (executive summary, disclaimer). The PDF intentionally does NOT render
 *    raw Markdown; it extracts the disclaimer verbatim and uses a short
 *    summary block for the executive bullets.
 *
 * If `memo` is omitted the PDF still renders with the engine data and falls
 * back to canned copy for the prose-heavy sections (used in dev / preview).
 */
export interface MemoPdfData {
  input: InvestorMemoInput;
  memo: InvestorMemoOutput | null;
  generatedAt: string;
  period: string;
  /**
   * Operational mining snapshot. Drives the hashrate / uptime / attestations
   * KPIs on the Mining Health page. Sourced from `MiningMetric` + `Proof` via
   * `loadMiningOpsSnapshot`; falls back to canned values when the DB is
   * empty so the PDF still renders in dev.
   */
  miningOps: MiningOpsSnapshot;
  /**
   * Trailing monthly performance rows. Drives the performance overview
   * table (Est. return band + NAV). Sourced from `VaultSnapshot`; padded with
   * a deterministic synthetic series (flagged `is_synthetic`) only when not
   * enough real months exist. v3.0 note: BTC accumulates over the term with
   * rule-based take-profit — there is NO periodic cash distribution, so no
   * distribution figure is threaded into or rendered by the PDF.
   */
  monthlyHistory: VaultMonthlyRow[];
}

/**
 * Maps the agent-side `ProvenanceTag` vocabulary onto the PDF badge's
 * `PdfProvenanceKind`. The two enums overlap on
 * `live | oracle | attested | estimated | manual | stale`; the tags with no
 * PDF badge (`fallback` → derived default, `pending` → number not yet
 * computable) both collapse to `estimated` so a not-attested value is NEVER
 * printed as attested/live. Used to badge memo KPIs from `input.provenance`
 * (CLAUDE.md non-negotiable #2) instead of hardcoded literals.
 */
export function provenanceTagToPdfKind(tag: ProvenanceTag): PdfProvenanceKind {
  switch (tag) {
    case "live":
      return "live";
    case "oracle":
      return "oracle";
    case "attested":
      return "attested";
    case "estimated":
      return "estimated";
    case "manual":
      return "manual";
    case "stale":
      return "stale";
    case "fallback":
    case "pending":
      return "estimated";
  }
}

/**
 * Months of history shown on the Performance Overview page. Matches the
 * existing "trailing 4-month performance" copy in the PDF.
 */
const MEMO_MONTHLY_HISTORY_WINDOW = 4;

/**
 * Server-side helper that batches the PDF-only loaders (mining ops + monthly
 * history) behind a single `Promise.all`. The PDF action and any other server
 * caller should pass the results to `MemoDocument` via `MemoPdfData`.
 *
 * This function does NOT load the structured `InvestorMemoInput` because
 * different callers source it differently (Phase 1 dev: mock; production:
 * `loadMemoInput` from `loaders/vault.ts`); the caller passes it in.
 */
export async function loadMemoPdfExtras(): Promise<{
  miningOps: MiningOpsSnapshot;
  monthlyHistory: VaultMonthlyRow[];
}> {
  const [miningOps, monthlyHistory] = await Promise.all([
    loadMiningOpsSnapshot(),
    loadVaultMonthlyHistory(MEMO_MONTHLY_HISTORY_WINDOW),
  ]);
  return { miningOps, monthlyHistory };
}

export type { MiningOpsSnapshot, VaultMonthlyRow };

export { formatApyRange } from "@/lib/format/apy";

export function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatPct(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/**
 * Period label like "January 2026" derived from an ISO date.
 */
export function periodFromIso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Extracts the first 3-4 bullets from the executive summary Markdown so the
 * cover/page 2 can show structured highlights. If we can't find bullets,
 * falls back to splitting on sentences.
 */
export function extractBullets(md: string, max = 4): string[] {
  const lines = md.split("\n").map((l) => l.trim());
  const bullets = lines
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l.length > 0);
  if (bullets.length > 0) {
    return bullets.slice(0, max);
  }
  // Fallback: take the first paragraph and split into sentences.
  const firstPara = md.split(/\n\s*\n/).find((p) => p.trim().length > 0) ?? "";
  const sentences = firstPara
    .replace(/\n+/g, " ")
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.slice(0, max);
}

/**
 * Strips Markdown emphasis / headings from a string so it renders as
 * plain text inside react-pdf `<Text>`.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\([^)]+\)/g, "$1")
    .replace(/\s+\n/g, "\n")
    .trim();
}
