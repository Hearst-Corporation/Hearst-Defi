import Link from "next/link";

import { getVaultMode } from "@/lib/chain/dynavault";
import { vaultModeLabel } from "@/lib/greenfield/wired";
import type { Series1ProofStepperState } from "@/lib/proof-center/series1-event-stepper";
import {
  Disclaimer,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";
import { ActivityFeed, Button } from "@/ui";

export function ProofCenterView({
  mode,
  vaultAddress,
  stepper,
}: {
  mode: ReturnType<typeof getVaultMode>;
  vaultAddress: string | null;
  stepper: Series1ProofStepperState;
}) {
  const v2Deployed = mode === "v2";

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Series 1"
        title="Proof Center"
        meta={vaultModeLabel(mode)}
        description="Source evidence for mining, reserve, custody and delivery across the Series 1 lifecycle."
        actions={
          <Link href="/proof-center/full">
            <Button variant="secondary">Full event log</Button>
          </Link>
        }
      />

      <Section index="01" title="Contract & network">
        <Panel>
          <RowList>
            <Row label="Vault mode" value={vaultModeLabel(mode)} />
            <Row
              label="Contract address"
              value={vaultAddress ?? "Not configured"}
            />
            <Row
              label="v2.1 deployed"
              value={v2Deployed ? "Yes" : "No — catalogue only"}
            />
            <Row label="Indexer status" value={stepper.envelopeStatus} />
          </RowList>
        </Panel>
      </Section>

      <Section index="02" title="Indexed events">
        <Panel title="Recent on-chain events">
          <div className="p-5">
            <ActivityFeed
              items={stepper.events.slice(0, 12).map((e) => ({
                id: e.id,
                title: e.displayLabel,
                detail: e.description,
                timestamp: e.occurredAt ?? `Block ${e.blockNumber}`,
                provenance: e.isKnownEventType ? "attested" : "manual",
              }))}
              emptyTitle={
                stepper.envelopeStatus === "not_configured"
                  ? "No indexer configured for this deployment"
                  : "No events indexed yet"
              }
            />
          </div>
        </Panel>
      </Section>

      <Disclaimer>
        Proof unavailable ≠ no proof. Until v2.1 is deployed there is nothing to
        index — saying so is different from claiming an empty ledger.
      </Disclaimer>
    </PageLayout>
  );
}
