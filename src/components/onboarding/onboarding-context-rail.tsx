import Link from "next/link";

import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { NestedCallout } from "@/components/ui/nested-panel";
import type { IrContact } from "@/lib/ir-contact";
import type { OnboardingChecklistItem, OnboardingStepId } from "@/lib/onboarding/state";
import { cn } from "@/lib/cn";

interface OnboardingRequirementsListProps {
  items: OnboardingChecklistItem[];
}

export function OnboardingRequirementsList({
  items,
}: OnboardingRequirementsListProps) {
  return (
    <NestedCallout aria-label="Onboarding requirements">
      <p className="eyebrow ct-text-muted m-0 mb-3">Requirements</p>
      <ul className="m-0 flex flex-col gap-[var(--ct-space-2_5)] p-0 list-none">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-[var(--ct-space-2_5)]">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                item.done
                  ? "border-[var(--ct-border-accent)] bg-[var(--ct-accent)] ct-text-deep"
                  : "border-[var(--ct-border-soft)] ct-text-muted",
              )}
            >
              {item.done ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="body-sm ct-text-body">
              {item.label}
              {item.optional ? (
                <span className="eyebrow ct-text-faint ml-[var(--ct-space-2)] align-middle">
                  Optional
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </NestedCallout>
  );
}

interface OnboardingChamberSoleProps {
  irContact: IrContact | null;
  compliance: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function OnboardingChamberSole({
  irContact,
  compliance,
  actions,
  backHref,
  backLabel = "← Back",
}: OnboardingChamberSoleProps) {
  return (
    <div className="flex flex-col gap-4">
      {actions}

      {backHref ? (
        <Link
          href={backHref}
          className="body-sm ct-text-muted no-underline hover:ct-text-primary transition-colors text-center"
        >
          {backLabel}
        </Link>
      ) : null}

      <p className="body-xs ct-text-faint m-0 text-pretty text-center">
        {compliance}
      </p>

      {irContact ? (
        <p className="body-xs ct-text-faint m-0 text-center text-pretty">
          Questions?{" "}
          <a
            href={`mailto:${irContact.email}`}
            className="text-[var(--ct-accent-strong)] no-underline hover:underline"
          >
            {irContact.name}
          </a>
          {irContact.calendlyHref ? (
            <>
              {" · "}
              <a
                href={irContact.calendlyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ct-accent-strong)] no-underline hover:underline"
              >
                Schedule a call
              </a>
            </>
          ) : null}
        </p>
      ) : null}

    </div>
  );
}

/** Lightweight stepper bridge for identity/wallet until chamber slice 2. */
export function OnboardingLegacyStepBridge({
  activeStep,
  children,
}: {
  activeStep: OnboardingStepId;
  children: React.ReactNode;
}) {
  return (
    <div className="onboarding-shell__legacy flex flex-col gap-8 w-full">
      <StepProgressBar active={activeStep} />
      {children}
    </div>
  );
}
