import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProofCenterFullSections } from "@/components/proof-center/proof-center-full-sections";
import type { FilterValue } from "@/components/proof/proof-filter-types";
import type { UnifiedProof } from "@/components/proof/proof-types";
import type { OnChainEvent } from "@/lib/chain/event-logger";
import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import type { ProofCenterTimelockProposal } from "@/components/proof-center/proof-center-full-sections";

interface ProofCenterFullLogLayoutProps {
  variant: "product" | "admin";
  vaultSuffix?: string;
  backHref: string;
  onChainEvents: ReadonlyArray<OnChainEvent>;
  proofs: ReadonlyArray<UnifiedProof>;
  platformAddresses: ReadonlyArray<PlatformAddressEntry>;
  filter: FilterValue;
  timelockProposals: ReadonlyArray<ProofCenterTimelockProposal>;
  actions?: ReactNode;
}

export function ProofCenterFullLogLayout({
  variant,
  vaultSuffix,
  backHref,
  onChainEvents,
  proofs,
  platformAddresses,
  filter,
  timelockProposals,
  actions,
}: ProofCenterFullLogLayoutProps) {
  const admin = variant === "admin";
  const contextLabel = admin
    ? `Proof · Full Log · ${vaultSuffix || "Vault"}`
    : "Proof · Full Log";

  const backLink = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 text-[length:var(--ct-text-2xs)] font-medium text-[var(--ct-text-muted)] no-underline hover:text-[var(--ct-text-strong)] transition-colors"
      aria-label="Back to Proof Center"
    >
      <ArrowLeft className="ct-icon-sm" aria-hidden />
      Proof Center
    </Link>
  );

  return (
    <div className="dark flex flex-col gap-y-5">
      {admin ? (
        <AdminPageHeader
          titleLead="Full"
          titleAccent="Log"
          contextLabel={contextLabel}
          lead={backLink}
          actions={actions}
        />
      ) : (
        <ProductPageHeader
          titleLead="Full"
          titleAccent="Log"
          contextLabel={contextLabel}
          lead={backLink}
        />
      )}

      <ProofCenterFullSections
        onChainEvents={onChainEvents}
        proofs={proofs}
        platformAddresses={platformAddresses}
        filter={filter}
        timelockProposals={timelockProposals}
        variant={variant}
      />
    </div>
  );
}
