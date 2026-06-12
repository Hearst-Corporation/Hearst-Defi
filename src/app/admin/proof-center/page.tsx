export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getEventLoggerAddress,
  getPoRRegistryAddress,
  isChainConfigured,
} from "@/lib/chain/client";
import { abbreviateAddress } from "@/lib/onchain";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";

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

  // Latest PoR attestation for the summary panel (descending order, index 0 = newest)
  const latestAttestation = onChainAttestations[0] ?? null;
  // A4 — the "Attested" badge requires the attestor to be allowlisted, not just
  // a fresh timestamp. Fail-closed when the allowlist is unset.
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  const eventLoggerAddr = getEventLoggerAddress();
  const porRegistryAddr = getPoRRegistryAddress();

  const proofs: UnifiedProof[] = [
    ...onChainAttestations.map(
      (data): UnifiedProof => ({
        source: "on-chain",
        kind: "attestation",
        data,
      }),
    ),
    ...onChainEvents.map(
      (data): UnifiedProof => ({
        source: "on-chain",
        kind: "event",
        data,
      }),
    ),
    ...paper.map((p): UnifiedProof => ({ ...p, source: "paper" })),
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
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

      {/* ── Proof of Reserves summary ───────────────────────── */}
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

      {/* ── On-chain event timeline ─────────────────────────── */}
      <section aria-labelledby="event-timeline-heading">
        <h2 id="event-timeline-heading" className="sr-only">
          On-chain event log
        </h2>
        <EventTimeline events={onChainEvents} />
      </section>

      {/* ── Full proof grid (platform-wide, type-filtered only) ── */}
      <section aria-labelledby="proof-grid-heading">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 id="proof-grid-heading" className="h2">
            Platform-wide proofs
          </h2>
          {proofs.length > 0 ? <ProofFilter /> : null}
        </div>
        {proofs.length === 0 ? (
          <AwaitingMetricState
            message="No proofs published yet"
            detail="Off-chain attestations, custody snapshots, and audits will appear here once posted. On-chain entries are read live from Base Sepolia."
          />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} />
        )}
      </section>

      {/* ── Deployed contracts + audit trail ───────────────── */}
      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="h2 mb-6">
          Deployments &amp; contract audit trail
        </h2>
        <ContractsAuditTrail />
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
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
