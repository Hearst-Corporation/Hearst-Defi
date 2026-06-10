/**
 * S3 — Identity / KYC page.
 *
 * Wires the real Persona embed when NEXT_PUBLIC_PERSONA_TEMPLATE_ID is set
 * in the environment, otherwise falls back to a static placeholder so the
 * page still renders cleanly in setups without Persona credentials.
 *
 * Non-negotiable #5: no forbidden words.
 */

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Button } from "@/components/ui/button";
import { PersonaPlaceholder } from "@/components/onboarding/PersonaPlaceholder";
import { IdentityStep } from "@/components/onboarding/identity-step";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const session = await getSession();
  const referenceId = session?.userId;
  const templateId = process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID;
  const rawEnv = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT;
  const environment: "sandbox" | "production" = rawEnv === "production" ? "production" : "sandbox";
  const personaReady = typeof templateId === "string" && templateId.length > 0;

  return (
    <div className="ct-card w-full max-w-lg flex flex-col gap-6">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Step 3 of 4"
        title="Identity Verification"
        description={
          <>
            AML / KYC verification is required prior to onboarding. The process
            takes approximately 3–5 minutes and requires a valid government-issued ID.
          </>
        }
      />

      {/* Persona embed (real SDK) when configured, placeholder otherwise */}
      {personaReady ? (
        <IdentityStep
          templateId={templateId}
          environment={environment}
          referenceId={referenceId}
        />
      ) : (
        <PersonaPlaceholder />
      )}

      {/* Navigation */}
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" asChild className="w-full font-bold">
          <Link href="/onboarding/wallet">
            Continue to Wallet Binding
          </Link>
        </Button>
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href="/onboarding/accreditation">
            ← Back
          </Link>
        </Button>
      </div>

      <p className="body-xs ct-text-faint text-pretty">
        KYC review typically completes within 24 hours. You will be notified by
        email once your identity has been verified.
      </p>
    </div>
  );
}
