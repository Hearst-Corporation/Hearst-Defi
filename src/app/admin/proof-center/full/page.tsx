// Admin Proof Center — Layer-2 drill-down (full log).
// Unbounded content: on-chain event log, off-chain proofs grid,
// contracts & audit trail. Data fetched fresh — standalone, no parent prop-drill.
// Requires admin auth; uses admin-doc-shell for natural scroll.

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";

export const metadata = {
  title: "Proof Center — Full log (Admin)",
  description:
    "On-chain event log, off-chain proofs, contracts and audit trail — operator view.",
};

interface AdminProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function AdminProofCenterFullPage({
  searchParams,
}: AdminProofCenterFullPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const chainConfigured = isChainConfigured();

  const [onChainEvents, paper, custody, showDemoBanner] = await Promise.all([
    fetchOnChainEvents({ limit: 100 }),
    getProofs().then((r) => r.data),
    loadCustody(),
    databaseHasDemoProofs(),
  ]);

  const platformAddresses = buildPlatformAddresses(custody);

  const proofs: UnifiedProof[] = paper.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proof Center — Full log"
        description="On-chain event log, off-chain proofs, contracts and audit trail."
        lead={
          <Link
            href="/admin/proof-center"
            className="inline-flex items-center gap-[var(--ct-space-1_5)] body-sm ct-text-muted no-underline hover:ct-text-primary ct-transition-base self-start mb-[var(--ct-space-2)]"
            aria-label="Back to Proof Center hub"
          >
            <ArrowLeft className="ct-icon-sm" aria-hidden />
            Proof Center
          </Link>
        }
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={0}
          />
        }
      />

      {showDemoBanner ? <DemoDataBanner /> : null}

      {/* ── On-chain event log ── */}
      <section aria-labelledby="event-timeline-heading">
        <h2 id="event-timeline-heading" className="h2 mb-[var(--ct-space-8)]">
          On-chain event log
        </h2>
        <EventTimeline events={onChainEvents} sectionLed />
      </section>

      {/* ── Off-chain proofs & documents ── */}
      <section aria-labelledby="proof-grid-heading">
        <div className="mb-[var(--ct-space-8)] admin-doc-section__head">
          <h2 id="proof-grid-heading" className="h2">
            Off-chain proofs &amp; documents
          </h2>
          {proofs.length > 0 ? <ProofFilter /> : null}
        </div>
        {proofs.length === 0 ? (
          <EmptySurface live {...PLATFORM_PROOFS_EMPTY} />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} />
        )}
      </section>

      {/* ── Contracts & review trail ── */}
      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="h2 mb-[var(--ct-space-8)]">
          Contracts &amp; review trail
        </h2>
        <ContractsAuditTrail platformAddresses={platformAddresses} />
      </section>

      {/* ── Footer: data provenance ── */}
      <footer
        style={{
          marginTop: "var(--ct-space-2)",
          paddingTop: "var(--ct-space-6)",
          borderTop: "1px solid var(--ct-border-soft)",
        }}
      >
        <DashboardPanelHeader
          eyebrow="Read path"
          title="Data provenance"
          tone="quiet"
        />
        <p className="body-xs ct-prose-md ct-text-muted">
          On-chain entries are read from the configured network (testnet until mainnet
          deployment). Off-chain entries are pinned to IPFS or signed HTTPS endpoints.
          Vault state is fetched fresh on every request.
        </p>
      </footer>
    </div>
  );
}
