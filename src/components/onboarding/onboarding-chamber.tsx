"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { PanelStatusSection } from "@/components/ui/panel-status";
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
    <PanelStatusSection label="Requirements" aria-label="Onboarding requirements">
      <ul className="m-0 p-0 list-none product-doc-stack--list">
        {items.map((item) => (
          <li key={item.id} className="product-doc-inline-row product-doc-inline-row--start product-doc-inline-row--loose">
            <span
              aria-hidden
              className={cn(
                "ct-checklist-dot",
                item.done ? "ct-checklist-dot--done" : undefined,
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
    </PanelStatusSection>
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
    <div className="product-doc-stack--relaxed">
      {actions}

      <p className="body-xs ct-text-faint m-0 text-pretty text-center">
        {compliance}
      </p>

      {irContact ? (
        <p className="body-xs ct-text-faint m-0 text-center text-pretty">
          Questions?{" "}
          <a
            href={`mailto:${irContact.email}`}
            className="ct-link-accent hover:underline"
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
                className="ct-link-accent hover:underline"
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
