import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PATH_META, ONBOARDING_PATHS } from "@/lib/onboarding-types";
import type { OnboardingPath } from "@/lib/onboarding-types";

export const metadata = {
  title: "LP Onboarding — Hearst Connect",
  description: "Select your investor type to begin the onboarding process.",
};

const PATH_ICONS: Record<OnboardingPath, React.ReactNode> = {
  individual: (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="14"
        cy="10"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 24c0-5.523 4.477-10 10-10s10 4.477 10 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  corporate: (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="8"
        width="22"
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 8V6a5 5 0 0110 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3 14h22"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
  fund: (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 22l6-8 5 4 5-10 4 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function OnboardingIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="h1">
          LP Onboarding
        </h1>
        <p className="mt-3 text-sm text-[var(--ct-text-muted)]">
          Select your investor type to begin. All information is encrypted and
          treated as confidential under the Hearst Connect investor agreement.
        </p>
      </div>

      {/* Path selection grid */}
      <div
        className="grid gap-4 sm:grid-cols-3"
        role="list"
        aria-label="Onboarding path selection"
      >
        {ONBOARDING_PATHS.map((path) => {
          const meta = PATH_META[path];
          return (
            <Link
              key={path}
              href={`/onboarding/${path}`}
              className="group block outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)] rounded-[var(--ct-radius-lg)]"
              role="listitem"
            >
              <Card className="h-full cursor-pointer border-[var(--ct-border)] transition-all duration-[var(--ct-dur-base)] hover:border-[var(--ct-accent)] hover:shadow-[0_0_0_1px_var(--ct-accent)] p-6">
                {/* Icon */}
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--ct-radius-md)] border border-[var(--ct-border)] bg-[var(--ct-surface-1)] text-[var(--ct-accent)]">
                  {PATH_ICONS[path]}
                </div>

                {/* Text */}
                <h2 className="h2 group-hover:text-[var(--ct-accent)] transition-colors duration-[var(--ct-dur-base)]">
                  {meta.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--ct-text-muted)]">
                  {meta.subtitle}
                </p>

                {/* Arrow */}
                <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[var(--ct-text-dim)] group-hover:text-[var(--ct-accent)] transition-colors duration-[var(--ct-dur-base)]">
                  <span>Begin onboarding</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    className="translate-x-0 group-hover:translate-x-0.5 transition-transform duration-[var(--ct-dur-base)]"
                  >
                    <path
                      d="M3 7h8M7 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p className="mt-10 text-center text-xs text-[var(--ct-text-dim)]">
        Minimum investment: $250,000 USDC. 60-day soft lock-up applies.
        Participation does not constitute a solicitation in any jurisdiction
        where such offers are prohibited. Not financial advice.
      </p>
    </main>
  );
}
