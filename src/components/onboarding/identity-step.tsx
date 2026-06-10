"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { PersonaEmbed } from "@/components/onboarding/persona-embed";

interface IdentityStepProps {
  templateId: string;
  environment: "sandbox" | "production";
  referenceId?: string;
}

/**
 * Client wrapper around PersonaEmbed that handles the post-completion
 * navigation. Lives in its own file so the page stays a Server Component.
 */
export function IdentityStep({ templateId, environment, referenceId }: IdentityStepProps) {
  const router = useRouter();

  const handleComplete = useCallback(() => {
    router.push("/onboarding/wallet");
  }, [router]);

  return (
    <PersonaEmbed
      templateId={templateId}
      environment={environment}
      referenceId={referenceId}
      onComplete={handleComplete}
    />
  );
}
