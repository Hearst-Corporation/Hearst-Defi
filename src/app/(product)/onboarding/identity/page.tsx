/**
 * Step 2 — Identity / KYC (Persona when configured).
 */

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { IdentityVendorPanel } from "@/components/onboarding/identity-vendor-panel";
import { IdentityStep } from "@/components/onboarding/identity-step";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import {
  isPersonaConfigured,
  personaEnvironment,
} from "@/lib/onboarding/config";
import { canProceedToWallet } from "@/lib/onboarding/gates";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const session = await getSession();
  const referenceId = session?.userId;
  const personaReady = isPersonaConfigured();
  const templateId = process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID ?? "";
  const environment = personaEnvironment();
  const mayContinue =
    session?.userId != null
      ? await canProceedToWallet(session.userId)
      : false;

  return (
    <Card className="flex flex-col gap-6" data-testid="onboarding-identity">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Onboarding · Step 2 of 3"
        title="Identity verification"
        description={
          <>
            AML / KYC verification is required prior to onboarding. The process
            takes approximately 3–5 minutes and requires a valid government-issued ID.
          </>
        }
      />

      {personaReady ? (
        <IdentityStep
          templateId={templateId}
          environment={environment}
          referenceId={referenceId}
        />
      ) : (
        <IdentityVendorPanel isProduction={process.env.NODE_ENV === "production"} />
      )}

      <div className="flex flex-col gap-3">
        {mayContinue ? (
          <Button variant="primary" size="lg" asChild className="w-full font-bold">
            <Link href="/onboarding/wallet">Continue to wallet binding</Link>
          </Button>
        ) : personaReady ? (
          <p className="body-xs ct-text-faint m-0" role="status">
            Launch identity verification above to continue.
          </p>
        ) : process.env.NODE_ENV !== "production" ? (
          <Button variant="secondary" size="lg" asChild className="w-full">
            <Link href="/onboarding/wallet">Continue (dev — vendor not configured)</Link>
          </Button>
        ) : null}

        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href="/onboarding/accreditation">← Back</Link>
        </Button>
      </div>

      <p className="body-xs ct-text-faint text-pretty m-0">
        KYC review typically completes within 24 hours. You will be notified by
        email once your identity has been verified.
      </p>
    </Card>
  );
}
