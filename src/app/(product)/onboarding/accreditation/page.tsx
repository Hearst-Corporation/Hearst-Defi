/**
 * S2 — Accreditation page.
 *
 * Three Rule 506(c) + Cayman PIF attestation checkboxes.
 * "Continue" is disabled until all boxes are checked.
 * Non-negotiable #10: "not guaranteed" disclaimer in the checkbox copy.
 * Non-negotiable #5: no forbidden words.
 */

"use client";

import { useRouter } from "next/navigation";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { AccreditationCheckboxes } from "@/components/onboarding/AccreditationCheckboxes";

export default function AccreditationPage() {
  const router = useRouter();

  function handleContinue() {
    // Navigate to next step: S3 identity
    router.push("/onboarding/identity?step=identity");
  }

  return (
    <div className="ct-card w-full max-w-lg flex flex-col gap-6">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Step 2 of 7"
        title="Investor Accreditation"
        description={
          <>
            Hearst Yield Vault is offered exclusively to accredited investors under
            SEC Rule 506(c) and eligible participants under Cayman Islands law.
            Please confirm each statement below.
          </>
        }
      />

      {/* Attestation checkboxes */}
      <AccreditationCheckboxes onContinue={handleContinue} />

      {/* Footer disclaimer */}
      <p className="body-xs ct-text-faint text-pretty">
        False attestation may result in immediate termination of participation.
        This is not a solicitation of investment. All projections are estimates
        subject to stated assumptions — not a commitment of future returns.
      </p>
    </div>
  );
}
