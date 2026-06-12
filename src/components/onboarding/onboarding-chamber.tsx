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
  className?: string;
  testId?: string;
}

/**
 * Institutional Chamber — single premium surface for onboarding steps.
 * Crown (stepper + title) · Body (step content) · Sole (CTA + compliance).
 */
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
