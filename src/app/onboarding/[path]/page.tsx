import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { StepContent } from "@/components/onboarding/step-content";
import {
  STEPS_BY_PATH,
  PATH_META,
  parseOnboardingPath,
} from "@/lib/onboarding-types";

interface OnboardingPathPageProps {
  params: Promise<{ path: string }>;
  searchParams: Promise<{ step?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string }>;
}): Promise<Metadata> {
  const { path: rawPath } = await params;
  const path = parseOnboardingPath(rawPath);
  if (!path) return { title: "Onboarding — Hearst Connect" };

  const meta = PATH_META[path];
  return {
    title: `${meta.title} Onboarding — Hearst Connect`,
    description: meta.subtitle,
  };
}

export default async function OnboardingPathPage({
  params,
  searchParams,
}: OnboardingPathPageProps) {
  const { path: rawPath } = await params;
  const { step: stepParam } = await searchParams;

  const path = parseOnboardingPath(rawPath);
  if (!path) notFound();

  const steps = STEPS_BY_PATH[path];
  const meta = PATH_META[path];

  // Resolve current step from query param (0-indexed), clamped to valid range
  const rawStep = stepParam !== undefined ? parseInt(stepParam, 10) : 0;
  const currentStep =
    Number.isNaN(rawStep) || rawStep < 0
      ? 0
      : rawStep >= steps.length
        ? steps.length - 1
        : rawStep;

  const activeStep = steps[currentStep];
  if (!activeStep) notFound();

  return (
    <>
      {/* Sticky stepper */}
      <OnboardingStepper
        steps={steps}
        currentStep={currentStep}
        pathLabel={meta.title}
      />

      {/* Page body */}
      <main className="mx-auto max-w-3xl px-[var(--ct-space-6)] py-[var(--ct-space-10)]">
        <ProductPageHeader
          className="mb-8"
          eyebrow={`Step ${currentStep + 1} of ${steps.length}`}
          title={activeStep.label}
          description={activeStep.description}
        />

        {/* Step content (stubs / placeholders) */}
        <StepContent path={path} stepId={activeStep.id} />

        {/* Navigation */}
        <nav
          className="mt-10 flex items-center justify-between"
          aria-label="Step navigation"
        >
          {currentStep > 0 ? (
            <Link
              href={`/onboarding/${path}?step=${currentStep - 1}`}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--ct-text-muted)] hover:text-[var(--ct-text-strong)] transition-colors duration-[var(--ct-dur-base)]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M11 7H3M7 3L3 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Previous
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--ct-text-muted)] hover:text-[var(--ct-text-strong)] transition-colors duration-[var(--ct-dur-base)]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M11 7H3M7 3L3 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Change path
            </Link>
          )}

          {currentStep < steps.length - 1 ? (
            <Link
              href={`/onboarding/${path}?step=${currentStep + 1}`}
              className="inline-flex items-center gap-2 rounded-[var(--ct-radius-full)] bg-[var(--ct-accent)] px-5 py-2 text-sm font-semibold text-[var(--ct-bg-deep)] shadow-[var(--ct-glow-subtle)] hover:bg-[var(--ct-accent-strong)] transition-colors duration-[var(--ct-dur-base)]"
            >
              Continue
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 7h8M7 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-[var(--ct-radius-full)] bg-[var(--ct-accent)] px-5 py-2 text-sm font-semibold text-[var(--ct-bg-deep)] shadow-[var(--ct-glow-subtle)] hover:bg-[var(--ct-accent-strong)] transition-colors duration-[var(--ct-dur-base)]"
            >
              Submit &amp; Complete
            </Link>
          )}
        </nav>
      </main>
    </>
  );
}
