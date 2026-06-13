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
