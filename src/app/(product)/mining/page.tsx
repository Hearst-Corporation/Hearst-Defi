/**
 * /mining — Advanced mining contribution view (off primary rail, PROMPT 227).
 */
import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";
import { PageErrorState } from "@/features/investor-ui/components/states/data-states";
import { isBackendError } from "@/lib/backend";
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

  // Preview path — fixtures only, no backend, cannot fail. Kept intact.
  if (previewMiningState) {
    const viewModel = await getFixtureInvestorUiDataSource({
      mining: previewMiningState,
    }).getMining();
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

  // Default path — real backend, no fixture fallback, no silent downgrade.
  // Backend down / network / 5xx / timeout → one honest page-level error,
  // never a page crash and never a fabricated fixture substitution.
  let viewModel;
  try {
    viewModel = await getInvestorUiDataSource().getMining();
  } catch (err) {
    const detail = isBackendError(err)
      ? `hearst-connect-backend did not respond (${err.code}${err.status ? `, HTTP ${err.status}` : ""}).`
      : "The data source failed unexpectedly.";
    return (
      <BentoPageShell testId="mining-page">
        <ProductPageHeader
          titleLead="Mining"
          contextLabel="CONTRIBUTION"
          titleRowEnd={<ProvenanceBadge kind="simulated" />}
        />
        <PageErrorState title="Mining contribution unavailable" detail={detail} />
      </BentoPageShell>
    );
  }

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
