/**
 * /btc — UI V2 BTC-accumulation view.
 *
 * Rail entry "BTC" in `PRODUCT_NAV` (`src/components/nav/product-nav-items.ts`).
 *
 * Composes A5's shared `BtcViewModel` (reserve + performance, via
 * `FixtureInvestorUiDataSource`) with page-scoped EXTRA blocks (production /
 * trajectory / take-profit ladder / custody / events / proofs / AI experts —
 * see `_data/btc-page-types.ts`) through `getBtcPageData()`. No Prisma /
 * Supabase / RPC / CoinGecko access in this file — everything flows through
 * the data-source seam.
 *
 * Preview states via `?state=`:
 *   - (default)          — complete, all blocks resolved
 *   - not-configured      — PermissionedDynaVault v2.1 not deployed
 *   - stale               — indexer lag
 *   - partial             — some blocks resolved, some not
 */
import { AccordionCard } from "@/components/catalyst/accordion";
import { BentoPageShell, BentoPanel, BentoHeader } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { BtcHero } from "./_components/btc-hero";
import { BtcTrajectoryChart } from "./_components/btc-trajectory-chart";
import { BtcProductionPanel } from "./_components/btc-production-panel";
import { BtcPerformancePanel } from "./_components/btc-performance-panel";
import { BtcTakeProfitLadder } from "./_components/btc-take-profit-ladder";
import { BtcCustodyPanel } from "./_components/btc-custody-panel";
import { BtcEventsTimeline } from "./_components/btc-events-timeline";
import { BtcProofsPanel } from "./_components/btc-proofs-panel";
import { BtcAiExpertsRail } from "./_components/btc-ai-experts-rail";
import { formatIsoDateTime } from "./_data/format-btc";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BTC · Hearst Connect",
};

export default async function BtcPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  await requireInvestor("/btc");
  const { state } = await searchParams;
  const data = await getBtcPageData(state);

  return (
    <BentoPageShell testId="btc-page">
      <ProductPageHeader
        titleLead="BTC"
        contextLabel="ACCUMULATION"
        titleRowEnd={
          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
            <ProvenanceBadge kind="simulated" />
            <span className="ct-metric-caption">as of {formatIsoDateTime(data.generatedAt)}</span>
          </span>
        }
      />

      {/* Single full-width column (PROMPT 225): the persistent 320px AI-experts
          column is removed — advisory folds to a full-width strip at the foot so
          the accumulation content spans the full usable width. */}
      <div className="flex min-w-0 flex-col gap-[var(--ct-space-4)]">
        <AccordionCard title="Reserve & trajectory" collapsible={false}>
          <div className="flex flex-col gap-[var(--ct-space-5)] p-[var(--ct-space-5)]">
            <BtcHero reserve={data.reserve} trajectory={data.extra.trajectory} />
            <BtcTrajectoryChart trajectory={data.extra.trajectory} />
          </div>
        </AccordionCard>

        <AccordionCard title="Mining production" defaultOpen persistKey="btc-production">
          <div className="p-[var(--ct-space-5)]">
            <BtcProductionPanel production={data.extra.production} />
          </div>
        </AccordionCard>

        <AccordionCard title="Performance" defaultOpen persistKey="btc-performance">
          <div className="p-[var(--ct-space-5)]">
            <BtcPerformancePanel performance={data.performance} />
          </div>
        </AccordionCard>

        <AccordionCard title="Take-profit ladder" defaultOpen persistKey="btc-ladder">
          <div className="p-[var(--ct-space-5)]">
            <BtcTakeProfitLadder ladder={data.extra.takeProfitLadder} />
          </div>
        </AccordionCard>

        <AccordionCard title="Custody" persistKey="btc-custody">
          <div className="p-[var(--ct-space-5)]">
            <BtcCustodyPanel custody={data.extra.custody} />
          </div>
        </AccordionCard>

        <AccordionCard title="Event timeline" persistKey="btc-events">
          <div className="p-[var(--ct-space-5)]">
            <BtcEventsTimeline events={data.extra.events} />
          </div>
        </AccordionCard>

        <BentoPanel>
          <div className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
            <BentoHeader
              title="Proofs & provenance"
              subtitle="Attestations backing the figures on this page"
            />
            <BtcProofsPanel proofs={data.extra.proofs} />
          </div>
        </BentoPanel>

        <BentoPanel>
          <div className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
            <BentoHeader title="AI experts" subtitle="Advisory only — no autonomous action" />
            <BtcAiExpertsRail experts={data.extra.aiExperts} />
          </div>
        </BentoPanel>
      </div>
    </BentoPageShell>
  );
}
