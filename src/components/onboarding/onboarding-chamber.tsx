"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { NestedCallout } from "@/components/ui/nested-panel";
import type { IrContact } from "@/lib/ir-contact";
import type { OnboardingChecklistItem } from "@/lib/onboarding/state";
import { cn } from "@/lib/cn";

interface OnboardingShellContextValue {
  checklist: OnboardingChecklistItem[];
  irContact: IrContact | null;
}

const OnboardingShellContext = createContext<OnboardingShellContextValue | null>(
  null,
);

export function OnboardingShellProvider({
  checklist,
  irContact,
  children,
}: OnboardingShellContextValue & { children: ReactNode }) {
  return (
    <OnboardingShellContext.Provider value={{ checklist, irContact }}>
      {children}
    </OnboardingShellContext.Provider>
  );
}

export function useOnboardingShell(): OnboardingShellContextValue {
  const value = useContext(OnboardingShellContext);
  if (value == null) {
    throw new Error("useOnboardingShell must be used within OnboardingShellProvider");
  }
  return value;
}

interface OnboardingChamberProps {
  crown: ReactNode;
  body: ReactNode;
  sole: ReactNode;
  className?: string;
  testId?: string;
}

/** Single premium surface — Crown · Body · Sole. */
export function OnboardingChamber({
  crown,
  body,
  sole,
  className,
  testId,
}: OnboardingChamberProps) {
  return (
    <article
      className={cn("onboarding-chamber ct-glass-panel", className)}
      data-testid={testId}
    >
      <header className="onboarding-chamber__crown">{crown}</header>
      <div className="onboarding-chamber__body">{body}</div>
      <footer className="onboarding-chamber__sole">{sole}</footer>
    </article>
  );
}

export function OnboardingRequirementsList({
  items,
}: {
  items: OnboardingChecklistItem[];
}) {
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
                  aria-hidden
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

export function OnboardingChamberSole({
  irContact,
  compliance,
  actions,
}: {
  irContact: IrContact | null;
  compliance: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {actions}

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
