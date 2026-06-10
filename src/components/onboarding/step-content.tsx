import { getSession } from "@/lib/auth/session";
import { DocsignPlaceholder } from "@/components/onboarding/docsign-placeholder";
import { DocusignStep } from "@/components/onboarding/docusign-step";
import { IdentityStep } from "@/components/onboarding/identity-step";
import { PersonaPlaceholder } from "@/components/onboarding/PersonaPlaceholder";

interface StepContentProps {
  path: "individual" | "corporate" | "fund";
  stepId: string;
}

/**
 * Maps a (path, stepId) pair to the appropriate step panel.
 *
 * Real integrations:
 *   - KYC steps → PersonaEmbed when NEXT_PUBLIC_PERSONA_TEMPLATE_ID is set,
 *     PersonaPlaceholder otherwise.
 *   - DocuSign steps → DocusignStep when DOCUSIGN_* env vars are all present,
 *     DocsignPlaceholder otherwise.
 *
 * Never crashes when keys are absent — all embeds have graceful fallbacks.
 */
export async function StepContent({ path, stepId }: StepContentProps) {
  // Resolve session once — used by DocuSign to supply the real email.
  // getSession() is server-only and returns null when unauthenticated.
  const session = await getSession();

  // ── Persona KYC configuration ─────────────────────────────────────────────
  const personaTemplateId = process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID;
  const personaRawEnv = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT;
  const personaEnvironment: "sandbox" | "production" =
    personaRawEnv === "production" ? "production" : "sandbox";
  const personaReady =
    typeof personaTemplateId === "string" && personaTemplateId.length > 0;

  // ── DocuSign configuration (server-side env only) ─────────────────────────
  const docusignConfigured =
    Boolean(process.env.DOCUSIGN_BASE_URL) &&
    Boolean(process.env.DOCUSIGN_API_KEY) &&
    Boolean(process.env.DOCUSIGN_ACCOUNT_ID);

  // Resolve user identity for DocuSign recipient fields.
  // Falls back gracefully when no session is present (shows placeholder).
  const userId = session?.userId ?? "";
  const email = session?.email ?? "";
  const hasIdentity = Boolean(userId) && Boolean(email);

  // ── KYC helper ────────────────────────────────────────────────────────────
  function renderKyc() {
    if (personaReady && personaTemplateId) {
      return (
        <IdentityStep
          templateId={personaTemplateId}
          environment={personaEnvironment}
          referenceId={userId || undefined}
        />
      );
    }
    return <PersonaPlaceholder />;
  }

  // ── DocuSign helper ───────────────────────────────────────────────────────
  // DocusignStep handles the case where !configured or !hasIdentity by
  // rendering the appropriate placeholder internally.
  function renderDocusign(label: string) {
    if (!docusignConfigured || !hasIdentity) {
      return <DocsignPlaceholder label={label} />;
    }
    return (
      <DocusignStep
        label={label}
        userId={userId}
        email={email}
        vaultId="HYV-A"
        amount={250_000}
        configured={docusignConfigured}
      />
    );
  }

  // ── Individual path ───────────────────────────────────────────────────────
  if (path === "individual") {
    if (stepId === "kyc") return renderKyc();
    if (stepId === "accreditation") {
      return renderDocusign("Eligibility attestation — accredited investor confirmation");
    }
    if (stepId === "bank-wire") return <BankWirePanel renderDocusign={renderDocusign} />;
  }

  // ── Corporate path ────────────────────────────────────────────────────────
  if (path === "corporate") {
    if (stepId === "entity-docs") {
      return renderDocusign("Entity documents — certificate of incorporation and operating agreement");
    }
    if (stepId === "ubo") {
      return renderDocusign("Beneficial owners — ultimate beneficial owners at 10% or more");
    }
    if (stepId === "kyc-officer") return renderKyc();
    if (stepId === "bank-wire") return <BankWirePanel renderDocusign={renderDocusign} />;
  }

  // ── Fund path ─────────────────────────────────────────────────────────────
  if (path === "fund") {
    if (stepId === "fund-formation") {
      return renderDocusign("Fund formation docs — LPA, PPM and audited financial statements");
    }
    if (stepId === "aml") {
      return renderDocusign("AML documentation — compliance officer designation and policies");
    }
    if (stepId === "sub-advisor") {
      return renderDocusign("Sub-advisor authority — delegated investment authority");
    }
    if (stepId === "master-account") {
      return renderDocusign("Master account setup — omnibus account and allocation keys");
    }
  }

  // Fallback — should never be reached with valid data
  return (
    <div className="rounded-lg border border-[var(--ct-border)] ct-surface-1 px-6 py-10 text-center">
      <p className="text-sm ct-text-muted">
        Step content not found.
      </p>
    </div>
  );
}

/** Shared bank wire info panel (individual + corporate). */
function BankWirePanel({
  renderDocusign,
}: {
  renderDocusign: (label: string) => React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--ct-border)] ct-surface-1 px-6 py-8">
      <h3 className="mb-4 h3">
        Payout Instructions
      </h3>
      <p className="mb-6 text-xs ct-text-muted">
        USDC payouts are delivered monthly to your designated bank
        account. Provide your wire instructions below. This is not a
        deposit — wire details are used for outbound distributions only.
      </p>
      {renderDocusign("Payout instructions — SWIFT/IBAN details secured via DocuSign")}
    </div>
  );
}
