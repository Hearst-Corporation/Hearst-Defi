import "server-only";

import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { getDeployment } from "@/lib/chain/deployments";
import { EXPLORER_ADDRESS_BASE, getHearstPublisherAddress } from "@/lib/chain/client";
import type { CustodySnapshot } from "@/lib/data/custody";
import { resolveVaultAddress } from "@/lib/onchain/vault";

/** Vault / manager / custody rows for the Proof Center address panel. */
export function buildPlatformAddresses(
  custody: CustodySnapshot | null,
): PlatformAddressEntry[] {
  const vaultFromEnv = resolveVaultAddress();
  const vaultFromRegistry = getDeployment("vault").address;
  const vaultAddr = vaultFromEnv ?? vaultFromRegistry;
  const manager = getHearstPublisherAddress();

  const custodyScope =
    custody && custody.configured && custody.accountsCount > 0
      ? `${custody.accountsCount} Fireblocks vault account${custody.accountsCount === 1 ? "" : "s"}`
      : null;

  return [
    {
      label: "Hearst Yield Vault (ERC-4626)",
      address: vaultAddr,
      description:
        "ERC-4626 share vault on Base Sepolia. USDC deposits mint vault shares representing pro-rata NAV.",
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
