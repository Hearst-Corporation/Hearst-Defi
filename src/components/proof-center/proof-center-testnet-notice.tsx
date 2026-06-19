import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Testnet + optional demo notices — mounted on every Proof Center surface when
 * `isChainConfigured()` is true and/or a demo disclaimer applies.
 */
export function ProofCenterTestnetNotice({
  chainConfigured,
  demoNotice = null,
  className,
}: {
  chainConfigured: boolean;
  demoNotice?: string | null;
  className?: string;
}) {
  if (!chainConfigured && !demoNotice) return null;

  return (
    <div
      role="note"
      aria-label="Proof Center notices"
      className={cn("product-doc-callout", className)}
    >
      {chainConfigured ? (
        <TriangleAlert
          className="ct-icon-sm ct-icon-sm--offset-top ct-status-warning"
          aria-hidden
        />
      ) : null}
      <div className="product-doc-stack product-doc-stack--tight min-w-0">
        {chainConfigured ? (
          <p className="body-sm ct-text-strong m-0">
            On-chain proofs are read from a{" "}
            <strong>test network</strong> — not production mainnet. Addresses,
            balances, and attestations shown here are test artefacts.
          </p>
        ) : null}
        {demoNotice ? (
          <p className="body-sm ct-status-warning m-0 font-medium">{demoNotice}</p>
        ) : null}
      </div>
    </div>
  );
}
