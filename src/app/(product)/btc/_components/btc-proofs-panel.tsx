// src/app/(product)/btc/_components/btc-proofs-panel.tsx
//
// Links out to the Proof Center for the attestations backing this page's
// figures — this page never re-renders the proof detail itself.

import Link from "next/link";
import { FileCheck } from "lucide-react";

import {
  DataNotConfigured,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BtcProofRefViewModel } from "../_data/btc-page-types";

export function BtcProofsPanel({
  proofs,
}: {
  proofs: ResolvedViewModel<readonly BtcProofRefViewModel[]>;
}) {
  if (proofs.status === "NOT_CONFIGURED" || proofs.value === null) {
    return (
      <DataNotConfigured
        label="Proofs"
        detail="No attestations are available for this vault yet."
      />
    );
  }

  return (
    <ul role="list" className="flex flex-col divide-y divide-[var(--ct-border-soft)]">
      {proofs.value.map((proof) => (
        <li key={proof.href + proof.label}>
          <Link
            href={proof.href}
            className="ct-focus-ring flex items-center gap-[var(--ct-space-3)] py-[var(--ct-space-3)] body-sm ct-text-body hover:ct-text-strong transition-colors ease-[var(--ct-ease)]"
          >
            <FileCheck aria-hidden="true" className="h-4 w-4 shrink-0 ct-text-muted" />
            <span className="min-w-0 flex-1 truncate">{proof.label}</span>
            <span aria-hidden="true" className="ct-text-muted">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
