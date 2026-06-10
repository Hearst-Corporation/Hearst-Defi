// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// This is a standalone page; it does NOT re-export the admin version.

export const dynamic = "force-dynamic";

import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { prisma } from "@/lib/db";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";

interface ProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProductProofCenterPage({
  searchParams,
}: ProofCenterPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const chainConfigured = isChainConfigured();
  const [onChainEvents, onChainAttestations, paper, custody, timelockProposals] =
    await Promise.all([
      fetchOnChainEvents({ limit: 20 }),
      fetchOnChainAttestations({ limit: 12 }),
      getProofs().then((r) => r.data),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: { state: "TIMELOCK" },
        orderBy: { queuedAt: "asc" },
      }),
    ]);

  const latestAttestation = onChainAttestations[0] ?? null;

  // P1 — live distribution coverage for the Yield vault, current calendar month.
  const coveragePeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  const coverage = await loadCoverageForVault("hearst-yield-vault", coveragePeriod);

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
    <div className="space-y-12">
      {/* ── Testnet notice ─────────────────────────────────── */}
      {chainConfigured && (
        <div
          role="note"
          aria-label="Testnet data notice"
          className="rounded-[var(--ct-radius-md)] border border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] px-4 py-3"
        >
          <p className="body-sm text-[var(--ct-text-strong)]">
            ⚠️ On-chain proofs are read from{" "}
            <strong>Base Sepolia (testnet)</strong> — not production mainnet.
            Addresses, balances, and attestations shown here are testnet
            artefacts.
          </p>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow mb-1">Hearst Yield Vault</span>
          <h1 className="h1">Proof Center</h1>
          <p className="body-sm mt-2 max-w-2xl ct-text-muted">
            Every data point that backs the vault — mining attestations, custody
            snapshots, audits, and the methodology itself — hashed and posted
            with its source URI.
          </p>
        </div>
        <ChainStatusBadge
          configured={chainConfigured}
          eventCount={onChainEvents.length}
          attestationCount={onChainAttestations.length}
        />
      </div>

      {/* ── Proof of Reserves summary ───────────────────────── */}
      <section aria-labelledby="por-heading">
        <h2 id="por-heading" className="sr-only">
          Proof of Reserves
        </h2>
        <PorSummary attestation={latestAttestation} custody={custody} />
      </section>

      {/* ── Mining cash-flow evidence (yield source) ───────────── */}
      <section aria-labelledby="cashflow-heading">
        <h2 id="cashflow-heading" className="sr-only">
          Mining cash-flow evidence
        </h2>
        <MiningCashFlowEvidence coverage={coverage} />
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
            All proofs
          </h2>
          <ProofFilter />
        </div>
        {proofs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[var(--ct-radius-lg)] ct-border-soft ct-surface-1 py-16 text-center">
            <ProvenanceBadge kind="stale" />
            <div className="space-y-1">
              <p className="body-sm font-medium ct-text-strong">
                No proofs published yet
              </p>
              <p className="body-xs max-w-md">
                Off-chain attestations, custody snapshots, and audits will
                appear here once posted. On-chain entries are read live from
                Base Sepolia.
              </p>
            </div>
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

      {/* ── Governance timelocks ───────────────────────────── */}
      {timelockProposals.length > 0 && (
        <section aria-labelledby="timelock-heading">
          <h2 id="timelock-heading" className="h2 mb-6">
            Pending governance timelocks
          </h2>
          <div className="space-y-4">
            {timelockProposals.map((proposal) => (
              <TimelockCountdown
                key={proposal.id}
                proposalId={proposal.id}
                queueTime={(proposal.queuedAt ?? proposal.createdAt).toISOString()}
                delayHours={proposal.timelockHours ?? TIMELOCK_DELAY_HOURS}
              />
            ))}
          </div>
        </section>
      )}

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
