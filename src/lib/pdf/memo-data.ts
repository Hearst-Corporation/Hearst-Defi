import "server-only";

import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import {
  loadLatestDistribution,
  type DistributionSnapshot,
} from "@/lib/agents/loaders/distribution";
import {
  loadMiningOpsSnapshot,
  type MiningOpsSnapshot,
} from "@/lib/agents/loaders/mining";
import {
  loadVaultMonthlyHistory,
  type VaultMonthlyRow,
} from "@/lib/agents/loaders/vault";
import type { InvestorMemoOutput } from "@/lib/agents/schemas";

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
   * The latest distribution (paid or scheduled) for the period. Drives the
   * "Distribution paid" KPI on the executive summary. Sourced from
   * `Distribution`; falls back to a synthesised 0.8% × AUM scheduled entry
   * when the table is empty.
   */
  distribution: DistributionSnapshot | null;
  /**
   * Trailing monthly performance rows. Drives the performance overview
   * table. Sourced from `VaultSnapshot` joined with `Distribution`; falls
   * back to a deterministic synthetic series when not enough months exist.
   */
  monthlyHistory: VaultMonthlyRow[];
}

/**
 * Months of history shown on the Performance Overview page. Matches the
 * existing "trailing 4-month performance" copy in the PDF.
 */
const MEMO_MONTHLY_HISTORY_WINDOW = 4;

/**
 * Server-side helper that batches the three PDF-only loaders behind a single
 * `Promise.all`. The PDF action and any other server caller should pass the
 * results to `MemoDocument` via `MemoPdfData`.
 *
 * This function does NOT load the structured `InvestorMemoInput` because
 * different callers source it differently (Phase 1 dev: mock; production:
 * `loadMemoInput` from `loaders/vault.ts`); the caller passes it in.
 */
export async function loadMemoPdfExtras(): Promise<{
  miningOps: MiningOpsSnapshot;
  distribution: DistributionSnapshot | null;
  monthlyHistory: VaultMonthlyRow[];
}> {
  const [miningOps, distribution, monthlyHistory] = await Promise.all([
    loadMiningOpsSnapshot(),
    loadLatestDistribution(),
    loadVaultMonthlyHistory(MEMO_MONTHLY_HISTORY_WINDOW),
  ]);
  return { miningOps, distribution, monthlyHistory };
}

export type { DistributionSnapshot, MiningOpsSnapshot, VaultMonthlyRow };

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
