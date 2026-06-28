import { DashboardPanelHeader } from "@/components/catalyst/dashboard-panel-header";

/**
 * Single source of truth for the Proof Center "Data provenance" footer.
 *
 * Always present at the bottom of both /full drill-downs (product + admin), so
 * it lives in one place instead of being duplicated verbatim per page. Spacing
 * is owned by `.proof-provenance-block` in doc-flow.css.
 */
export function ProvenanceFooter() {
  return (
    <footer className="proof-provenance-block flex flex-col gap-3">
      <DashboardPanelHeader eyebrow="Read path" title="Data provenance" tone="quiet" />
      <p className="max-w-prose text-[12px] leading-relaxed text-[var(--ct-text-faint)]">
        On-chain entries are read from the configured network (testnet until mainnet
        deployment). Off-chain entries are pinned to IPFS or signed HTTPS endpoints.
        Vault state is fetched fresh on every request.
      </p>
    </footer>
  );
}
