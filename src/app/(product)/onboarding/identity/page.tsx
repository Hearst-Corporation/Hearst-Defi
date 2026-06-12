/**
 * Step 2 — Identity / KYC (Persona when configured).
 */

import { IdentityChamber } from "@/components/onboarding/identity-chamber";
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
    <IdentityChamber
      personaReady={personaReady}
      templateId={templateId}
      environment={environment}
      referenceId={referenceId}
      mayContinue={mayContinue}
      isProduction={process.env.NODE_ENV === "production"}
    />
  );
}
