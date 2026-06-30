"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

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
  /**
   * Optional companion column rendered beside the crown/body/sole stack (used
   * by /apply for the inline assistant). When omitted, the chamber keeps its
   * single-column crown · body · sole layout — every other surface is unchanged.
   */
  aside?: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Single premium surface — Crown · Body · Sole.
 *
 * Pure Tailwind bento — matches the Portfolio page and the converted vault term
 * sheet: `rounded-2xl border border-[var(--ct-border)] bg-surface-card`, uniform `p-5` zones and
 * section borders in `border-[var(--ct-border-soft)]` (Portfolio rhythm — no `sm:` overrides).
 * The optional split (`aside`) stacks below `md` and goes side-by-side above it.
 */
export function OnboardingChamber({
  crown,
  body,
  sole,
  aside,
  className,
  testId,
}: OnboardingChamberProps) {
  const stack = (
    <>
      <header className="flex flex-col gap-4 p-5">
        {crown}
      </header>
      <div className="flex flex-col gap-5 p-5 border-t border-[var(--ct-border-soft)]">
        {body}
      </div>
      <footer
        className={cn(
          "p-5",
          aside
            ? "[&>*]:pt-5 [&>*]:border-t [&>*]:border-[var(--ct-border-soft)]"
            : "border-t border-[var(--ct-border-soft)] bg-surface-inset",
        )}
      >
        {sole}
      </footer>
    </>
  );

  return (
    <article
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)]",
        aside && "md:flex-row md:items-stretch",
        className,
      )}
      data-testid={testId}
    >
      {aside ? (
        <>
          <div className="flex min-w-0 flex-col md:flex-1">{stack}</div>
          <div className="flex min-w-0 border-t border-[var(--ct-border-soft)] md:w-[var(--ct-rail-right)] md:shrink-0 md:border-t-0 md:border-l">
            {aside}
          </div>
        </>
      ) : (
        stack
      )}
    </article>
  );
}

export function OnboardingRequirementsList({
  items,
}: {
  items: OnboardingChecklistItem[];
}) {
  return (
    <div aria-label="Onboarding requirements" className="flex flex-col gap-3">
      <p className="ct-bento-label">Requirements</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                item.done
                  ? "border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] ct-text-accent"
                  : "border-[var(--ct-border)] bg-surface-inset text-transparent",
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
            <span className="body-sm ct-text-primary">
              {item.label}
              {item.optional ? (
                <span className="ct-bento-label ml-2 align-middle">
                  Optional
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
    <div className="flex flex-col gap-5">
      {actions}

      <p className="body-xs m-0 text-pretty text-center">{compliance}</p>

      {irContact ? (
        <p className="body-xs m-0 text-pretty text-center">
          Questions?{" "}
          <a href={`mailto:${irContact.email}`} className="ct-link-accent">
            {irContact.name}
          </a>
          {irContact.calendlyHref ? (
            <>
              {" · "}
              <a
                href={irContact.calendlyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ct-link-accent"
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
