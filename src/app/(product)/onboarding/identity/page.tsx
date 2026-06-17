/**
 * Step 2 — Identity / KYC.
 *
 * Document-only (id-only level) verification through OUR native Cockpit form —
 * no Sumsub WebSDK, iframe, or CDN asset. The form's server action creates the
 * Sumsub applicant, binds applicantId→userId server-side (P0-4), uploads the
 * document over the REST API, and the GREEN/RED verdict lands on the webhook.
 */

import { IdentityChamber } from "@/components/onboarding/identity-chamber";
import { getSession } from "@/lib/auth/session";
import { isSumsubConfigured } from "@/lib/onboarding/config";
import { canProceedToWallet } from "@/lib/onboarding/gates";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const session = await getSession();
  const kycVendorReady = isSumsubConfigured();

  const mayContinue =
    session?.userId != null
      ? await canProceedToWallet(session.userId)
      : false;

  return (
    <IdentityChamber
      kycVendorReady={kycVendorReady}
      mayContinue={mayContinue}
      isProduction={process.env.NODE_ENV === "production"}
    />
  );
}
