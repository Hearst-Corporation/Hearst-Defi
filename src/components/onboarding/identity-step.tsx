"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { KycDocumentForm } from "@/components/onboarding/kyc-document-form";

/**
 * Client wrapper — renders OUR native Cockpit KYC document form (no Sumsub
 * WebSDK / iframe / CDN) and navigates to wallet binding once the document has
 * been submitted for verification.
 */
export function IdentityStep() {
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    router.push("/onboarding/wallet");
  }, [router]);

  return <KycDocumentForm onSuccess={handleSuccess} />;
}
