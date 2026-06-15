import Link from "next/link";

import { cn } from "@/lib/cn";
import type { VaultId } from "@/lib/engine/types";
import {
  DASHBOARD_FIXTURE_VAULTS,
  isEngineFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";

interface FixtureVaultPillsProps {
  activeVaultId: string;
  resolveHref: (vaultId: VaultId) => string;
  /** Defaults to "Vault scope". */
  ariaLabel?: string;
}

/**
 * Engine-fixture vault pills (yield / defensive / btc-plus).
 * Shared by admin surfaces that scope simulations to a single vault (ADR-006 #9).
 */
export function FixtureVaultPills({
  activeVaultId,
  resolveHref,
  ariaLabel = "Vault scope",
}: FixtureVaultPillsProps) {
  const activeFixture = isEngineFixtureVaultId(activeVaultId) ? activeVaultId : null;

  return (
    <nav aria-label={ariaLabel} className="fixture-vault-pills">
      {DASHBOARD_FIXTURE_VAULTS.map((vault) => {
        const href = resolveHref(vault.id);
        const active = activeFixture === vault.id;
        const shortName = vault.label
          .replace(/^Hearst\s+/i, "")
          .replace(/\s+Vault$/i, "");

        return (
          <Link
            key={vault.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "fixture-vault-pills__pill",
              active && "fixture-vault-pills__pill--active",
            )}
            title={vault.label}
          >
            <span className="fixture-vault-pills__ticker">{vault.ticker}</span>
            <span className="fixture-vault-pills__name" aria-hidden>
              · {shortName}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
