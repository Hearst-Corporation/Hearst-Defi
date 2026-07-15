import "server-only";

import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { getVaultTarget } from "@/lib/chain/dynavault";
import { getDeployment } from "@/lib/chain/deployments";
import { EXPLORER_ADDRESS_BASE, getHearstPublisherAddress } from "@/lib/chain/client";
import type { CustodySnapshot } from "@/lib/data/custody";
import { getVaultFullLabel } from "@/lib/vaults/dashboard-scope";

/** Vault / manager / custody rows for the Proof Center address panel. */
export function buildPlatformAddresses(
  custody: CustodySnapshot | null,
  vaultRef?: string,
): PlatformAddressEntry[] {
  // Resolve through the single vault passage point: which contract this app is
  // actually pointed at (v2 PermissionedDynaVault vs legacy ERC-4626) decides
  // both the address AND the standard label — hardcoding "(ERC-4626)" would lie
  // once the v2 vault is configured.
  const target = getVaultTarget();
  const vaultFromRegistry = getDeployment("vault").address;
  const vaultAddr = target.address ?? vaultFromRegistry;
  const manager = getHearstPublisherAddress();

  const custodyScope =
    custody && custody.configured && custody.accountsCount > 0
      ? `${custody.accountsCount} Fireblocks vault account${custody.accountsCount === 1 ? "" : "s"}`
      : null;

  const vaultLabel = getVaultFullLabel(vaultRef ?? "yield");

  // v2 is NOT an ERC-4626 (renamed views, non-standard events — see the adapter
  // header); legacy is the deployed ERC-4626. In not-configured mode we fall
  // back to the registry address, which is the legacy ERC-4626 deployment.
  const isV2 = target.mode === "v2";
  const standardLabel = isV2 ? "PermissionedDynaVault v2.1" : "ERC-4626";
  const vaultDescription = isV2
    ? "PermissionedDynaVault v2.1 share vault on Base Sepolia. USDC deposits mint vault shares (totalShares/shares, non-standard events) representing pro-rata NAV."
    : "ERC-4626 share vault on Base Sepolia. USDC deposits mint vault shares representing pro-rata NAV.";

  return [
    {
      label: `${vaultLabel} (${standardLabel})`,
      address: vaultAddr,
      description: vaultDescription,
      href: vaultAddr ? `${EXPLORER_ADDRESS_BASE}${vaultAddr}` : null,
    },
    {
      label: "Event publisher (testnet EOA)",
      address: manager,
      description:
        "Authorized EventLogger publisher on testnet. Phase 3 migrates to Gnosis Safe 3/5 manager multisig.",
      href: manager ? `${EXPLORER_ADDRESS_BASE}${manager}` : null,
    },
    {
      label: "Custody reserve scope (Fireblocks)",
      address: custodyScope,
      rowLabel: "Scope",
      description:
        "Off-chain USDC reserves held in pinned Fireblocks vault accounts. Not an on-chain contract address.",
      href: null,
    },
  ];
}
