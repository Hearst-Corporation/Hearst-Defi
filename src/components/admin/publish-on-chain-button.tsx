"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { publishProofOnChain } from "@/app/admin/proofs/actions";
import { Button } from "@/components/ui/button";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";
import { explorerTxUrlFromRegistry } from "@/lib/chain/deployments";

interface Props {
  proofId: string;
}

const TOAST_INFO_MS = 8000;
const TOAST_SUCCESS_MS = 10000;

/**
 * One-shot button that publishes a signed mining-attestation Proof to the
 * on-chain PoRRegistry. Only rendered for mining_attestation proofs that have
 * no txHash yet — the parent (AdminProofRow) is responsible for that gate.
 *
 * Outcomes surfaced inline via sonner toast:
 *   - armed + txHash   → success toast with explorer link
 *   - armed, no txHash → should not happen (publish returns a hash or null)
 *   - disarmed         → info toast (publisher not armed — expected on testnet setup)
 *   - error            → error toast
 */
export function PublishOnChainButton({ proofId }: Props) {
  const [isPending, startTransition] = useTransition();

  function onPublish() {
    const confirmed = window.confirm(
      "Publish this attestation to the on-chain PoRRegistry?\n\n" +
        "The signed payload figures (AUM, mined BTC, period) will be written to Base Sepolia. " +
        "This action cannot be undone.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await publishProofOnChain(proofId);

      if (!result.ok) {
        toast.error(`Publish failed: ${result.error}`);
        return;
      }

      if (!result.armed) {
        toast.info("Publisher not armed — no on-chain write occurred. Set HEARST_PUBLISHER_PRIVATE_KEY to enable.", {
          duration: TOAST_INFO_MS,
        });
        return;
      }

      if (result.txHash) {
        toast.success(
          <span>
            Attestation anchored.{" "}
            <a
              href={explorerTxUrlFromRegistry(result.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(explorerLinkClass, "underline underline-offset-2")}
            >
              {abbreviateAddress(result.txHash)} ↗
            </a>
          </span>,
          { duration: TOAST_SUCCESS_MS },
        );
      }
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onPublish}
      disabled={isPending}
    >
      {isPending ? "Publishing…" : "Publish on-chain"}
    </Button>
  );
}
