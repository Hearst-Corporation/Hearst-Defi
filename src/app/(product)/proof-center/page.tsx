// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// This is a standalone page; it does NOT re-export the admin version.

export const dynamic = "force-dynamic";

import { TriangleAlert } from "lucide-react";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
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
import {
  getEventLoggerAddress,
  getPoRRegistryAddress,
  isChainConfigured,
} from "@/lib/chain/client";
import { abbreviateAddress } from "@/lib/onchain";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoProofs } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
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

  // Demo provider (guard-gated → never production): the recognized demo
  // identity sees synthetic demo proofs in the grid instead of the DB rows.
  // The on-chain sections (events / attestations / custody / coverage) are
  // untouched and keep their normal testnet/empty states.
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);

  const [onChainEvents, onChainAttestations, paper, custody, timelockProposals, showDemoBanner] =
    await Promise.all([
      fetchOnChainEvents({ limit: 20 }),
      fetchOnChainAttestations({ limit: 12 }),
      demo
        ? Promise.resolve(buildDemoProofs())
        : getProofs().then((r) => r.data),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: { state: "TIMELOCK" },
        orderBy: { queuedAt: "asc" },
      }),
      databaseHasDemoProofs(),
    ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  // A4 — "Attested" badge requires a fresh attestation AND an allowlisted signer.
  // Mirrors the same computation used by the admin proof-center. Fail-closed when
  // there is no attestation or no allowlist configured.
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  // P1 — live distribution coverage for the Yield vault, current calendar month.
  const coveragePeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  const coverage = await loadCoverageForVault("hearst-yield-vault", coveragePeriod);

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
    <div className="proof-center-shell product-doc-shell">
      {/* ── Testnet notice ─────────────────────────────────── */}
      {chainConfigured && (
        <div
          role="note"
          aria-label="Testnet data notice"
          className="product-doc-callout"
        >
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 ct-status-warning"
            aria-hidden
          />
          <p className="body-sm ct-text-strong">
            On-chain proofs are read from{" "}
            <strong>Base Sepolia (testnet)</strong> — not production mainnet.
            Addresses, balances, and attestations shown here are testnet
            artefacts.
          </p>
        </div>
      )}

      <ProductPageHeader
        eyebrow="Hearst Yield Vault"
        title="Proof Center"
        description={
          <>
            Every data point that backs the vault — mining attestations, custody
            snapshots, audits, and the methodology itself — hashed and posted
            with its source URI.
          </>
        }
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={onChainAttestations.length}
          />
        }
      />

      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} />
      ) : showDemoBanner ? (
        <DemoDataBanner />
      ) : null}

      {/* ── Proof of Reserves summary ───────────────────────── */}
      <section aria-labelledby="por-heading">
        <h2 id="por-heading" className="sr-only">
          Proof of Reserves
        </h2>
        <PorSummary
          attestation={latestAttestation}
          custody={custody}
          verified={latestAttestationVerified}
          demo={demo}
        />
      </section>

      {/* ── Mining cash-flow evidence (yield source) ───────────── */}
      <section aria-labelledby="cashflow-heading">
        <h2 id="cashflow-heading" className="sr-only">
          Mining cash-flow evidence
        </h2>
        <MiningCashFlowEvidence coverage={coverage} />
      </section>

      {/* ── On-chain event timeline (only when chain is configured) ── */}
      {chainConfigured && (
        <section aria-labelledby="event-timeline-heading">
          <h2 id="event-timeline-heading" className="sr-only">
            On-chain event log
          </h2>
          <EventTimeline events={onChainEvents} />
        </section>
      )}

      {/* ── Full proof grid (filtered) ──────────────────────── */}
      <section aria-labelledby="proof-grid-heading">
        <Card hoverOverlay={false}>
          <div className="proof-center-section__toolbar">
            <DashboardPanelHeader
              id="proof-grid-heading"
              eyebrow="Proof catalog"
              title="Platform-wide proofs"
              titleLevel="section"
              tone="quiet"
              className="min-w-0 flex-1"
            />
            {proofs.length > 0 ? <ProofFilter /> : null}
          </div>
          {proofs.length === 0 ? (
            <AwaitingMetricState {...PLATFORM_PROOFS_EMPTY} />
          ) : (
            <ProofGrid proofs={proofs} filter={filter} demo={demo} />
          )}
        </Card>
      </section>

      {/* ── Deployed contracts + audit trail (only when chain is configured) ── */}
      {chainConfigured && (
        <section aria-labelledby="contracts-heading">
          <h2 id="contracts-heading" className="h2 mb-4">
            Deployments &amp; contract audit trail
          </h2>
          <ContractsAuditTrail />
        </section>
      )}

      {/* ── Governance timelocks ───────────────────────────── */}
      {timelockProposals.length > 0 && (
        <section aria-labelledby="timelock-heading">
          <h2 id="timelock-heading" className="h2 mb-4">
            Pending governance timelocks
          </h2>
          <div className="product-doc-stack--relaxed">
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
      <footer className="proof-center-footer">
        <p className="body-xs ct-prose-md ct-text-muted">
          {chainConfigured ? (
            <>
              On-chain entries are read directly from Base Sepolia (Testnet) via the
              EventLogger (
              <span className="mono">
                {eventLoggerAddr ? abbreviateAddress(eventLoggerAddr) : "not configured"}
              </span>
              ) and PoRRegistry (
              <span className="mono">
                {porRegistryAddr ? abbreviateAddress(porRegistryAddr) : "not configured"}
              </span>
              ) contracts.
              Off-chain entries are pinned to IPFS or signed HTTPS endpoints.
              On-chain data and vault state are fetched fresh on every request.
            </>
          ) : (
            <>
              Off-chain entries are pinned to IPFS or signed HTTPS endpoints.
              On-chain attestation will be enabled following mainnet deployment.
              Vault state is fetched fresh on every request.
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
