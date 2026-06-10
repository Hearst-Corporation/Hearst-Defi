export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultSelector } from "@/components/admin/vault-selector";
import { MemoShell } from "@/components/memo/memo-shell";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";
import type { VaultId } from "@/lib/engine/types";

// ---------------------------------------------------------------------------
// Selector options: fixture-only (yield / defensive / btc-plus).
//
// MemoShell generates a Kimi K2.6 document anchored to an engine fixture's
// vault snapshot + methodology preset. Deployment-scoped memos require
// per-deployment live snapshot resolution, which is gated on Phase 3
// multi-vault DB schema. Surfacing deployment slugs here would silently
// render a Yield-anchored memo under a different vault name — dishonest.
//
// When per-deployment memo generation lands (V2), replace this constant with
// a `listAllVaults({ status: "live-or-paused" })` call and pass the full
// catalog via `options`. MemoShell will need a `VaultRef` input at that point.
// ---------------------------------------------------------------------------
const FIXTURE_VAULT_OPTIONS = [
  { id: "yield", label: "Yield" },
  { id: "defensive", label: "Defensive" },
  { id: "btc-plus", label: "BTC Plus" },
] as const satisfies ReadonlyArray<{ id: string; label: string }>;

interface InvestorMemoPageProps {
  searchParams: Promise<{ vault?: string }>;
}

function resolveVaultId(raw: string | undefined): VaultId {
  if (raw === "yield" || raw === "defensive" || raw === "btc-plus") return raw;
  return VAULT_YIELD.id;
}

export default async function InvestorMemoPage({
  searchParams,
}: InvestorMemoPageProps) {
  const params = await searchParams;
  const vaultId = resolveVaultId(params.vault);
  const vault = VAULTS[vaultId];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Investor Memo"
        actions={
          <VaultSelector
            active={vaultId}
            options={FIXTURE_VAULT_OPTIONS}
            basePath="/admin/investor-memo"
            ariaLabel="Investor Memo vault selector"
          />
        }
      />
      <p className="body-sm max-w-2xl">
        Eight sections for{" "}
        <span className="ct-text-strong">{vault.label}</span>, generated on
        demand by Kimi K2.6 (Hypercli) against the current vault snapshot, scenarios,
        and backtests. Methodology v1.0, structured-output enforced (no chat),
        forbidden-words linted on every field. Nothing is auto-distributed —
        the memo only leaves this page when you download it.
      </p>

      <MemoShell vaultId={vaultId} vaultName={vault.label} />

      <footer className="border-t ct-border-soft pt-6">
        <p className="body-xs">
          Generated on demand from live vault data. Every export is logged with
          its methodology version. Projections are conditional on the stated
          assumptions and not guaranteed. Past performance does not predict
          future results.
        </p>
      </footer>
    </div>
  );
}
