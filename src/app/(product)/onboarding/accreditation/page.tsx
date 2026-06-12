/**
 * Step 1 — Accreditation attestations (Rule 506(c) + Cayman PIF).
 */

"use client";

import { useRouter } from "next/navigation";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { AccreditationCheckboxes } from "@/components/onboarding/AccreditationCheckboxes";
import { Card } from "@/components/ui/card";

export default function AccreditationPage() {
  const router = useRouter();

  function handleContinue() {
    router.push("/onboarding/identity");
  }

  return (
    <Card className="flex flex-col gap-6" data-testid="onboarding-accreditation">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Onboarding · Step 1 of 3"
        title="Investor accreditation"
        description={
          <>
            Hearst Yield Vault is offered exclusively to accredited investors under
            SEC Rule 506(c) and eligible participants under Cayman Islands law.
            Please confirm each statement below.
          </>
        }
      />

      <AccreditationCheckboxes onContinue={handleContinue} />

      <p className="body-xs ct-text-faint text-pretty m-0">
        False attestation may result in immediate termination of participation.
        This is not a solicitation of investment. All projections are estimates
        subject to stated assumptions — not a commitment of future returns.
      </p>
    </Card>
  );
}
