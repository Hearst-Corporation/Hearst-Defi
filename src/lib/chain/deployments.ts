import { z } from "zod";
import registryJson from "../../../config/deployments.base-sepolia.json";

type DeploymentName = "vault" | "eventLogger" | "porRegistry";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const deploymentEntrySchema = z.object({
  address: addressSchema,
  deployBlock: z.number().int().nonnegative(),
  deployTx: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  commitSha: z.string().min(1).nullable(),
  constructorArgs: z.array(z.string()),
  hasGuardian: z.boolean(),
  minDepositUsdc: z.number().int().nonnegative().nullable(),
  broadcastCommitted: z.boolean(),
  sourceMatchesCommitted: z.boolean(),
});

const registrySchema = z.object({
  chainId: z.number().int().positive(),
  contracts: z.object({
    vault: deploymentEntrySchema,
    eventLogger: deploymentEntrySchema,
    porRegistry: deploymentEntrySchema,
  }),
});

export type DeploymentRegistry = z.infer<typeof registrySchema>;
export type DeploymentEntry = z.infer<typeof deploymentEntrySchema>;

export interface DeploymentMeta {
  stale: boolean;
  reasons: string[];
  provenanceVerified: boolean;
}

export interface DeploymentView extends DeploymentEntry {
  name: DeploymentName;
  chainId: number;
  meta: DeploymentMeta;
}

let _cachedRegistry: DeploymentRegistry | null = null;

export function getDeploymentRegistry(): DeploymentRegistry {
  if (_cachedRegistry === null) {
    _cachedRegistry = registrySchema.parse(registryJson);
  }
  return _cachedRegistry;
}

export function computeStaleness(entry: DeploymentEntry): DeploymentMeta {
  const reasons: string[] = [];
  if (entry.constructorArgs.length === 5) {
    reasons.push("constructor-5-args");
  }
  if (entry.minDepositUsdc !== null && entry.minDepositUsdc < 250_000) {
    reasons.push("min-deposit-below-250k");
  }
  return {
    stale: reasons.length > 0,
    reasons,
    provenanceVerified:
      entry.broadcastCommitted && entry.sourceMatchesCommitted,
  };
}

export function getDeployment(name: DeploymentName): DeploymentView {
  const registry = getDeploymentRegistry();
  const entry = registry.contracts[name];
  return {
    ...entry,
    name,
    chainId: registry.chainId,
    meta: computeStaleness(entry),
  };
}

// ---------------------------------------------------------------------------
// Block-explorer helpers — chain-aware, safe for both client and server bundles.
//
// NOTE: src/lib/chain/client.ts also exports `explorerTxUrl` / `explorerAddressUrl`
// but that module is `server-only`. Import from HERE in "use client" components.
// ---------------------------------------------------------------------------

const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID_DEPLOYMENTS = 84532;

function explorerOriginFromChainId(chainId: number): string {
  return chainId === BASE_MAINNET_CHAIN_ID
    ? "https://basescan.org"
    : "https://sepolia.basescan.org"; // default: Base Sepolia (testnet)
}

/** Active chain id derived from the committed deployment registry. */
function activeChainId(): number {
  return getDeploymentRegistry().chainId ?? BASE_SEPOLIA_CHAIN_ID_DEPLOYMENTS;
}

/**
 * Block-explorer URL for a transaction hash on the active chain.
 * Safe for "use client" components (no server-only dependency).
 * Guard the link with `isPlaceholderTxHash` (src/lib/chain/client.ts) before
 * rendering — placeholder hashes resolve to 404 on BaseScan.
 */
export function explorerTxUrlFromRegistry(txHash: string): string {
  return `${explorerOriginFromChainId(activeChainId())}/tx/${txHash}`;
}

/**
 * Block-explorer URL for a contract/wallet address on the active chain.
 * Safe for "use client" components.
 */
function explorerAddressUrlFromRegistry(address: string): string {
  return `${explorerOriginFromChainId(activeChainId())}/address/${address}`;
}
