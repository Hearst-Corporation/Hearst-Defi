/**
 * /dashboard — UI V2 investor entry point. THE centre of the investor
 * experience: answers 5 questions on the first screen —
 *   1. Combien vaut ma position ?           → DashboardHero
 *   2. Comment mon capital est réparti ?     → PocketsComposition (B1/B2/B3)
 *   3. Quelle allocation est disponible ?    → AllocationCapacityPanel
 *   4. Que produit le mining ?               → MiningPulse
 *   5. Quelle est la prochaine action utile ? → "Allocate capital" CTA
 *      (AllocationCapacityPanel) → /vaults/hearst-yield-vault/invest
 *
 * Rail entry "Dashboard" in `PRODUCT_NAV` (`src/components/nav/product-nav-items.ts`),
 * the new primary landing page (A1). Composes A5's shared `DashboardViewModel`
 * + `MiningViewModel` (pulse) + `BtcViewModel` (performance) + the AI-experts
 * advisory rail, all via `getInvestorUiDataSource()` /
 * `getFixtureInvestorUiDataSource()` — no Prisma/Supabase/RPC/legacy
 * `src/lib/data/*` access in this file.
 *
 * `?state=` QA preview switcher (mirrors BTC/Mining): complete (default) /
 * partial / unavailable / not-configured / no-position / cap-full /
 * not-eligible. Unknown/absent falls back to "complete".
 */
import { BentoPageShell, BentoPanel, BentoHeader } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";

import { DashboardHero } from "./_components/dashboard-hero";
import { AllocationCapacityPanel } from "./_components/allocation-capacity-panel";
import { PocketsComposition } from "./_components/pockets-composition";
import { MiningPulse } from "./_components/mining-pulse";
import { PerformancePanel } from "./_components/performance-panel";
import { ActivityAlertsDistributions } from "./_components/activity-alerts-distributions";
import { AiExpertsRail } from "./_components/ai-experts-rail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · Hearst Connect",
};

/** `?state=` → the fixture variant it previews. Human-facing label is the key
 *  itself; kept as a flat map so QA can read every valid value at a glance. */
const FIXTURE_VARIANTS = [
  "complete",
  "partial",
  "unavailable",
  "not-configured",
  "no-position",
  "cap-full",
  "not-eligible",
] as const;

interface DashboardPageProps {
  searchParams: Promise<{ state?: string | string[] }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireInvestor("/dashboard");

  const params = await searchParams;
  const rawState = Array.isArray(params.state) ? params.state[0] : params.state;
  const previewState = rawState != null && (FIXTURE_VARIANTS as readonly string[]).includes(rawState) ? rawState : undefined;

  const dataSource = previewState
    ? getFixtureInvestorUiDataSource({ dashboard: previewState })
    : getInvestorUiDataSource();

  const [dashboard, mining, btc, aiExperts] = await Promise.all([
    dataSource.getDashboard(),
    dataSource.getMining(),
    dataSource.getBtc(),
    dataSource.getAiExperts(),
  ]);

  return (
    <BentoPageShell testId="dashboard-page">
      <ProductPageHeader
        titleLead="Dashboard"
        contextLabel="INVESTOR COCKPIT"
        titleRowEnd={
          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
            <ProvenanceBadge kind="simulated" />
          </span>
        }
      />

      {/* Single full-width column. The old layout hardcoded a persistent 320px
          "AI Experts" grid column that (with the shell chat rail also open)
          starved the main content to ~520px and read as a second product
          (PROMPT 225 / A2). AI advisory is now a compact collapsible strip at the
          foot of the page — the main content spans the full usable width. */}
      <div className="flex min-w-0 flex-col gap-[var(--ct-space-4)]">
        <DashboardHero position={dashboard.position} />

        <AllocationCapacityPanel
          capacity={dashboard.capacity}
          subscription={dashboard.subscription}
          position={dashboard.position}
        />

        <PocketsComposition allocation={dashboard.allocation} mining={mining} />

        <MiningPulse mining={mining} />

        <PerformancePanel btc={btc} />

        <BentoPanel>
          <div className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
            <BentoHeader title="Activity, alerts & distributions" subtitle="Recent account activity at a glance" />
            <ActivityAlertsDistributions
              activity={dashboard.activity}
              alerts={dashboard.alerts}
              distributions={dashboard.distributions}
            />
          </div>
        </BentoPanel>

        <AiExpertsRail aiExperts={aiExperts} />
      </div>
    </BentoPageShell>
  );
}
