// Mining page body — composes the flow canvas + KPI strip + per-block honest
// states. Server Component: no hooks, no client fetch, pure render off an
// already-resolved MiningViewModel.

import { Card, CardHeader, CardTitle } from "@/components/catalyst/card";
import {
  DataNotConfigured,
  DataStale,
  DataUnavailable,
} from "@/features/investor-ui/components/states/data-states";
import type { MiningViewModel } from "@/features/investor-ui/types/mining";

import { buildFlowStages } from "./build-flow-stages";
import { MiningFlowCanvas } from "./mining-flow-canvas";
import { MiningKpiStrip } from "./mining-kpi-strip";

interface MiningPageContentProps {
  viewModel: MiningViewModel;
}

export function MiningPageContent({ viewModel }: MiningPageContentProps) {
  const { mining, electricity } = viewModel;
  const { stages, summaryText } = buildFlowStages(mining, electricity);

  const bothNotConfigured =
    mining.status === "NOT_CONFIGURED" && electricity.status === "NOT_CONFIGURED";
  const bothUnavailable =
    mining.status === "UNAVAILABLE" && electricity.status === "UNAVAILABLE";

  return (
    <div className="flex flex-col gap-[var(--ct-space-5)]">
      <Card contentClassName="flex flex-col gap-[var(--ct-space-4)]">
        <CardHeader>
          <CardTitle>Mining flow</CardTitle>
        </CardHeader>

        {bothNotConfigured ? (
          <DataNotConfigured
            label="Mining flow"
            detail="PermissionedDynaVault v2.1 is not deployed yet — this diagram will populate once the keeper engine is indexed."
          />
        ) : bothUnavailable ? (
          <DataUnavailable label="Mining flow" />
        ) : (
          <MiningFlowCanvas
            stages={stages}
            fleetActive={mining.value?.fleetActive ?? null}
            curtailed={mining.value?.curtailed ?? null}
            summaryText={summaryText}
          />
        )}
      </Card>

      <div className="flex flex-col gap-[var(--ct-space-2)]">
        {mining.status === "NOT_CONFIGURED" ? (
          <DataNotConfigured
            label="Mining summary"
            detail="Fleet hashrate, BTC production and term progress read from PermissionedDynaVault v2.1, not deployed yet."
          />
        ) : mining.status === "UNAVAILABLE" ? (
          <DataUnavailable label="Mining summary" />
        ) : mining.status === "STALE" ? (
          <DataStale label="Mining summary" freshness={mining.freshness} />
        ) : null}

        {electricity.status === "NOT_CONFIGURED" ? (
          <DataNotConfigured
            label="Electricity"
            detail="Electricity cost and payment status read from PermissionedDynaVault v2.1, not deployed yet."
          />
        ) : electricity.status === "UNAVAILABLE" ? (
          <DataUnavailable label="Electricity" />
        ) : electricity.status === "STALE" ? (
          <DataStale label="Electricity" freshness={electricity.freshness} />
        ) : null}

        <MiningKpiStrip mining={mining} electricity={electricity} />
      </div>
    </div>
  );
}
