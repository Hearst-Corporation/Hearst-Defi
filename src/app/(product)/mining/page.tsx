/**
 * /mining — Advanced mining contribution view (off primary rail, PROMPT 227).
 */
import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/catalyst/provenance-badge";
import { PageErrorState } from "@/features/investor-ui/components/states/data-states";
import { isBackendError } from "@/lib/backend";
import { requireInvestor } from "@/lib/auth/require-investor";
import {
  getFixtureInvestorUiDataSource,
  getInvestorUiDataSource,
  type MiningFixtureState,
} from "@/features/investor-ui/data-source";
import type { DataStatus } from "@/features/investor-ui/types";

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

function miningHeaderProvenance(status: DataStatus): {
  kind: Provenance;
  description: string;
} {
  switch (status) {
    case "LIVE":
      return {
        kind: "live",
        description: "Current mining metrics resolved from hearst-connect-backend.",
      };
    case "STALE":
      return {
        kind: "stale",
        description: "Backend mining metrics resolved but are awaiting a fresher report.",
      };
    case "FIXTURE":
      return {
        kind: "simulated",
        description: "Explicit QA preview data — not a production record.",
      };
    case "PARTIAL":
      return {
        kind: "partial",
        description: "Only part of the backend mining report is available.",
      };
    case "NOT_CONFIGURED":
      return {
        kind: "partial",
        description: "Backend source pending — mining reporting is not configured.",
      };
    case "UNAVAILABLE":
    case "ERROR":
      return {
        kind: "partial",
        description: "Backend mining source unavailable — no fixture substituted.",
      };
  }
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
          titleRowEnd={
            <ProvenanceBadge
              kind="partial"
              description="Backend mining source unavailable — no fixture substituted."
            />
          }
        />
        <PageErrorState title="Mining contribution unavailable" detail={detail} />
      </BentoPageShell>
    );
  }

  const headerProvenance = miningHeaderProvenance(viewModel.mining.status);

  return (
    <BentoPageShell testId="mining-page">
      <ProductPageHeader
        titleLead="Mining"
        contextLabel="CONTRIBUTION"
        titleRowEnd={
          <ProvenanceBadge
            kind={headerProvenance.kind}
            description={headerProvenance.description}
          />
        }
      />
      <MiningPageContent viewModel={viewModel} />
    </BentoPageShell>
  );
}
