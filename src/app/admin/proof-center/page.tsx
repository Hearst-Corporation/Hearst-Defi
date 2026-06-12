export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { resolveVault } from "@/lib/vaults/resolver";
import { vaultLabel } from "@/lib/vaults/slug";

interface AdminProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[]; vault?: string }>;
}

export default async function AdminProofCenterPage({
  searchParams,
}: AdminProofCenterPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);
  const requestedVault = params.vault;

  // Resolve which vault is active — default to "yield" if none requested
  const resolvedRef = requestedVault
    ? await resolveVault(requestedVault)
    : null;
  const isAllVaults = !requestedVault;
  const scopeLabel = isAllVaults
    ? "All vaults"
    : (resolvedRef ? vaultLabel(resolvedRef) : requestedVault ?? "Unknown");

  const chainConfigured = isChainConfigured();
  const [onChainEvents, onChainAttestations, paper, custody] =
    await Promise.all([
      fetchOnChainEvents({ limit: 20 }),
      fetchOnChainAttestations({ limit: 12 }),
      getProofs().then((r) => r.data),
      loadCustody(),
    ]);

  // Latest PoR attestation for the summary panel (descending order, index 0 = newest)
  const latestAttestation = onChainAttestations[0] ?? null;
  // A4 — the "Attested" badge requires the attestor to be allowlisted, not just
  // a fresh timestamp. Fail-closed when the allowlist is unset.
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

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

      {/* ── Full proof grid (filtered) ──────────────────────── */}
      <section aria-labelledby="proof-grid-heading">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 id="proof-grid-heading" className="h2">
            {isAllVaults ? "All proofs" : `${scopeLabel} · proofs`}
          </h2>
          <ProofFilter />
        </div>
        {proofs.length === 0 ? (
          <div
            role="status"
            className="pf-empty-widget flex flex-col items-center justify-center gap-1 px-5 py-16 text-center"
          >
            <p className="body-sm ct-text-muted">No proofs published yet</p>
            <p className="body-xs ct-text-faint max-w-md">
              Off-chain attestations, custody snapshots, and audits will appear
              here once posted. On-chain entries are read live from Base Sepolia.
            </p>
          </div>
        ) : (
          <ProofGrid proofs={proofs} filter={filter} />
        )}
      </section>

      {/* ── Deployed contracts + audit trail ───────────────── */}
      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="h2 mb-6">
          Contracts &amp; audit trail
        </h2>
        <ContractsAuditTrail />
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-[var(--ct-border-soft)] pt-6">
        <p className="body-xs">
          On-chain entries are read directly from Base Sepolia via the
          EventLogger (<span className="mono">0xb07E…3D9E</span>) and
          PoRRegistry (<span className="mono">0x2B72…28D</span>) contracts.
          Off-chain entries are pinned to IPFS or signed HTTPS endpoints; Phase
          2 mirrors each new entry on-chain and surfaces the tx hash here.
          On-chain data and vault state are fetched fresh on every request.
        </p>
      </footer>
    </div>
  );
}
