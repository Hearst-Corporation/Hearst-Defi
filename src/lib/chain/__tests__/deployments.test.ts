import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getDeployment } from "@/lib/chain/deployments";

describe("deployments registry", () => {
  it("flags the live vault as stale", () => {
    const vault = getDeployment("vault");

    expect(vault.meta.stale).toBe(true);
    expect(vault.meta.reasons).toContain("constructor-5-args");
    expect(vault.meta.reasons).toContain("min-deposit-below-250k");
  });

  it("flags phase-2 addresses as unprovenanced", () => {
    const eventLogger = getDeployment("eventLogger");
    const porRegistry = getDeployment("porRegistry");

    expect(eventLogger.broadcastCommitted).toBe(false);
    expect(eventLogger.meta.provenanceVerified).toBe(false);
    expect(porRegistry.broadcastCommitted).toBe(false);
    expect(porRegistry.meta.provenanceVerified).toBe(false);
  });

  it("registry vault entry matches the committed broadcast", () => {
    const broadcastPath = join(
      process.cwd(),
      "contracts/broadcast/DeployHearstYieldVault.s.sol/84532/run-latest.json",
    );
    const broadcast = JSON.parse(readFileSync(broadcastPath, "utf-8")) as {
      transactions: Array<{
        hash: string;
        arguments: string[];
        contractAddress: string;
      }>;
      receipts: Array<{ blockNumber: string }>;
    };

    const tx = broadcast.transactions[0];
    const receipt = broadcast.receipts[0];
    if (tx === undefined || receipt === undefined) {
      throw new Error(
        "Committed vault broadcast is missing its first transaction/receipt — registry provenance cannot be verified.",
      );
    }
    const vault = getDeployment("vault");

    expect(vault.deployTx).toBe(tx.hash);
    expect(vault.deployBlock).toBe(parseInt(receipt.blockNumber, 16));
    expect(vault.constructorArgs).toEqual(tx.arguments);
    expect(vault.address.toLowerCase()).toBe(tx.contractAddress.toLowerCase());
  });
});
