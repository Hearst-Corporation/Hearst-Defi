import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { StrategyWorkspaceClient } from "@/components/admin/strategies/strategy-workspace-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { getStrategiesFromDb } from "../queries";

export const dynamic = "force-dynamic";

interface Props {
  // Next.js 16: dynamic route params are async and must be awaited.
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const workspaces = await getStrategiesFromDb();
  const strategy = workspaces.find((w) => w.strategy.slug === slug)?.strategy;
  if (!strategy) return { title: "Strategy Not Found" };
  return {
    title: `${strategy.name} — Strategy Workspace`,
  };
}

export default async function StrategyWorkspacePage({ params }: Props) {
  await requireAdmin();

  const { slug } = await params;
  const workspaces = await getStrategiesFromDb();
  const workspace = workspaces.find((w) => w.strategy.slug === slug);
  if (!workspace) {
    notFound();
  }

  const allStrategies = workspaces.map(w => w.strategy);

  // Today's BTC price anchors the agent's allocation + the price points.
  // Chainlink oracle → CoinGecko fallback; on total failure we surface an
  // honest "stale" provenance with the engine's reference price. Note that
  // `fetchBtcPrice` never throws (it swallows its own upstream failures) — on
  // a total outage it resolves with `usd: 0`, which the downstream scenario
  // math (allocation, price points) would silently treat as a real spot
  // price. Guard on that zero explicitly, not just on a thrown exception.
  let btcPriceUsd = 60_000;
  let btcPriceProvenance = "stale";
  try {
    const price = await fetchBtcPrice();
    if (price.usd > 0) {
      btcPriceUsd = price.usd;
      btcPriceProvenance = price.provenance;
    }
  } catch {
    // keep the stale fallback
  }

  return (
    <AdminPageShell
      titleLead="Strategy"
      titleAccent="Workspace"
      contextLabel={workspace.strategy.name}
    >
      <StrategyWorkspaceClient
        initialWorkspace={workspace}
        allInitialStrategies={allStrategies}
        btcPriceUsd={btcPriceUsd}
        btcPriceProvenance={btcPriceProvenance}
      />
    </AdminPageShell>
  );
}
