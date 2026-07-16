/**
 * /mining — Advanced mining contribution view (off primary rail, PROMPT 227).
 */
import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import {
  getFixtureInvestorUiDataSource,
  getInvestorUiDataSource,
  type MiningFixtureState,
} from "@/features/investor-ui/data-source";

import { MiningPageContent } from "./_components/mining-page-content";
import "./mining.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mining · Hearst Connect",
};

const PREVIEW_STATE_MAP: Record<string, MiningFixtureState> = {
  "mining-complete": "complete",
  "mining-stale": "stale",
  "mining-unavailable": "unavailable",
};

interface MiningPageProps {
  searchParams: Promise<{ state?: string | string[] }>;
}

export default async function MiningPage({ searchParams }: MiningPageProps) {
  await requireInvestor("/mining");

  const params = await searchParams;
  const rawState = Array.isArray(params.state) ? params.state[0] : params.state;
  const previewMiningState = rawState != null ? PREVIEW_STATE_MAP[rawState] : undefined;

  const dataSource = previewMiningState
    ? getFixtureInvestorUiDataSource({ mining: previewMiningState })
    : getInvestorUiDataSource();

  const viewModel = await dataSource.getMining();

  return (
    <BentoPageShell testId="mining-page">
      <ProductPageHeader
        titleLead="Mining"
        contextLabel="CONTRIBUTION"
        titleRowEnd={<ProvenanceBadge kind="simulated" />}
      />
      <MiningPageContent viewModel={viewModel} />
    </BentoPageShell>
  );
}
