export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getEventLoggerAddress,
  getPoRRegistryAddress,
  isChainConfigured,
} from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { abbreviateAddress } from "@/lib/onchain";

interface AdminProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[]; vault?: string }>;
}

export default async function AdminProofCenterPage({
  searchParams,
}: AdminProofCenterPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const vaultParam = Array.isArray(params.vault) ? params.vault[0] : params.vault;
  if (vaultParam) {
    const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
    const qs =
      rawType != null && rawType !== ""
        ? `?type=${encodeURIComponent(rawType)}`
        : "";
    redirect(`/admin/proof-center${qs}`);
  }

  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const chainConfigured = isChainConfigured();
  const [onChainEvents, onChainAttestations, paper, custody, showDemoBanner] =
    await Promise.all([
      fetchOnChainEvents({ limit: 20 }),
      fetchOnChainAttestations({ limit: 12 }),
      getProofs().then((r) => r.data),
      loadCustody(),
      databaseHasDemoProofs(),
    ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  const eventLoggerAddr = getEventLoggerAddress();
  const porRegistryAddr = getPoRRegistryAddress();

  const proofs: UnifiedProof[] = [
    ...onChainAttestations.map(
      (data): UnifiedProof => ({ source: "on-chain", kind: "attestation", data }),
    ),
    ...onChainEvents.map(
      (data): UnifiedProof => ({ source: "on-chain", kind: "event", data }),
    ),
    ...paper.map((p): UnifiedProof => ({ ...p, source: "paper" })),
  ];

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proof Center"
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={onChainAttestations.length}
          />
        }
      />

      {showDemoBanner ? <DemoDataBanner /> : null}

      <section aria-labelledby="por-heading">
        <h2 id="por-heading" className="sr-only">
          Proof of Reserves
        </h2>
        <PorSummary
          attestation={latestAttestation}
          custody={custody}
          verified={latestAttestationVerified}
        />
      </section>

      <section aria-labelledby="event-timeline-heading">
        <h2 id="event-timeline-heading" className="sr-only">
          On-chain event log
        </h2>
        <EventTimeline events={onChainEvents} />
      </section>

      <section aria-labelledby="proof-grid-heading">
        <div className="mb-6 admin-doc-section__head">
          <h2 id="proof-grid-heading" className="h2">
            Platform-wide proofs
          </h2>
          {proofs.length > 0 ? <ProofFilter /> : null}
        </div>
        {proofs.length === 0 ? (
          <AwaitingMetricState {...PLATFORM_PROOFS_EMPTY} />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} />
        )}
      </section>

      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="h2 mb-6">
          Deployments &amp; contract audit trail
        </h2>
        <ContractsAuditTrail />
      </section>

      <footer className="border-t border-[var(--ct-border-soft)] pt-6">
        <p className="body-xs">
          On-chain entries are read directly from Base Sepolia via the
          EventLogger (
          <span className="mono">
            {eventLoggerAddr ? abbreviateAddress(eventLoggerAddr) : "not configured"}
          </span>
          ) and PoRRegistry (
          <span className="mono">
            {porRegistryAddr ? abbreviateAddress(porRegistryAddr) : "not configured"}
          </span>
          ) contracts.
          Off-chain entries are pinned to IPFS or signed HTTPS endpoints; Phase
          2 mirrors each new entry on-chain and surfaces the tx hash here.
          On-chain data and vault state are fetched fresh on every request.
        </p>
      </footer>
    </div>
  );
}
