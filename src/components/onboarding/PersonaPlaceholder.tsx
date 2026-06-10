/**
 * PersonaPlaceholder — stub for the Persona KYC iframe (Phase 1 integration).
 *
 * Renders a visually consistent placeholder card that explains the KYC step
 * and signals the P1 integration work is pending. No real Persona SDK is
 * imported here — zero external dependency.
 *
 * Cockpit tokens only. Server Component (no interactivity needed at stub level).
 */

import { Badge } from "@/components/ui/badge";

export function PersonaPlaceholder() {
  return (
    <div
      className="w-full rounded-lg border border-dashed border-[var(--ct-border-soft)] ct-surface-1 p-8 flex flex-col items-center gap-4 text-center"
      role="region"
      aria-label="Identity verification — integration pending"
    >
      {/* Icon placeholder */}
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center w-12 h-12 rounded-full ct-surface-2 border border-[var(--ct-border-soft)] text-2xl"
      >
        🪪
      </span>

      <div className="flex flex-col gap-2">
        <h3 className="h3">
          Identity Verification
        </h3>
        <p className="body-sm ct-text-muted ct-prose-narrow">
          Secure KYC / AML verification via Persona. You will be guided through
          government-issued ID upload and liveness check.
        </p>
      </div>

      {/* Integration status badge */}
      <Badge variant="warning">
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
        Persona integration — P1
      </Badge>

      {/* Persona iframe mount point (populated in P1) */}
      <div
        id="persona-inquiry-container"
        data-testid="persona-iframe-placeholder"
        className="w-full min-h-[12.5rem] rounded-md border border-[var(--ct-border-soft)] ct-surface-0 flex items-center justify-center"
      >
        <span className="body-xs ct-text-faint">
          Persona iframe will mount here in P1
        </span>
      </div>

      <p className="body-xs ct-text-faint text-center text-pretty">
        Your documents are encrypted in transit and processed by Persona&apos;s
        SOC 2 Type II certified platform. Hearst Connect does not store raw document
        images.
      </p>
    </div>
  );
}
