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
 * sheet: `rounded-2xl border border-white/10 bg-black`, section borders in
 * `border-white/5`. The crown/body/sole zones keep their distinct padding and
 * the optional split (`aside`) stacks below `md` and goes side-by-side above it.
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
      <header className="flex flex-col gap-6 px-5 pt-6 pb-5 sm:px-8 sm:pt-10 sm:pb-6">
        {crown}
      </header>
      <div className="flex flex-col gap-6 px-5 pt-2 pb-6 border-t border-white/5 sm:px-8 sm:pb-8">
        {body}
      </div>
      <footer
        className={cn(
          "px-5 pt-5 pb-6 sm:px-8 sm:pt-6 sm:pb-8",
          aside ? "[&>*]:pt-5 sm:[&>*]:pt-6 [&>*]:border-t [&>*]:border-white/5" : "border-t border-white/5 bg-[#15191C]",
        )}
      >
        {sole}
      </footer>
    </>
  );

  return (
    <article
      className={cn(
        "dark relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-sm",
        aside && "md:flex-row md:items-stretch",
        className,
      )}
      data-testid={testId}
    >
      {aside ? (
        <>
          <div className="flex min-w-0 flex-col md:flex-1">{stack}</div>
          <div className="flex min-w-0 border-t border-white/5 md:w-[var(--ct-rail-right)] md:shrink-0 md:border-t-0 md:border-l">
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
      <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
        Requirements
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                item.done
                  ? "border-[#A7FB90]/40 bg-[#A7FB90]/10 text-[#A7FB90]"
                  : "border-white/10 bg-[#15191C] text-transparent",
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
            <span className="text-[13px] text-zinc-200">
              {item.label}
              {item.optional ? (
                <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
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

      <p className="m-0 text-pretty text-center text-[12px] leading-relaxed text-zinc-500">
        {compliance}
      </p>

      {irContact ? (
        <p className="m-0 text-pretty text-center text-[12px] leading-relaxed text-zinc-500">
          Questions?{" "}
          <a
            href={`mailto:${irContact.email}`}
            className="font-medium text-[#A7FB90] hover:underline"
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
                className="font-medium text-[#A7FB90] hover:underline"
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
