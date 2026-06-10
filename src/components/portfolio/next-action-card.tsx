import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * NextActionCard — the single, calm "what to do next" surface at the top of the
 * investor portfolio. Above the fold is for deciding; this card answers
 * "what's my next step?" in one glance.
 *
 * Pure derivation from already-loaded session/portfolio fields — NO fetch, NO
 * I/O, NO financial logic. It only reads status flags the page already has:
 *   - kycStatus            (Investor.kycStatus: pending | approved | rejected)
 *   - accreditationAttested (Investor.accreditationAttestedAt != null)
 *   - hasWallet            (Investor.walletAddress != null)
 *   - positionCount        (data.positions.length)
 *
 * Exactly one primary action is surfaced, by priority. When everything is in
 * place the card becomes a quiet "ready" confirmation rather than a CTA — the
 * premium signal is the absence of noise, not another button shouting.
 *
 * No forbidden words; no promised returns; institutional, not marketing.
 */

export interface NextActionCardProps {
  kycStatus: string;
  accreditationAttested: boolean;
  hasWallet: boolean;
  positionCount: number;
}

type Step = {
  /** Short eyebrow shown above the headline. */
  eyebrow: string;
  /** One calm sentence describing the state. */
  headline: string;
  /** Optional supporting line. */
  detail?: string;
  /** CTA — omitted in the serene "ready" state. */
  cta?: { label: string; href: string };
};

/** Resolve the single next step from status flags. Pure, total, order matters. */
export function resolveNextStep(props: NextActionCardProps): Step {
  const { kycStatus, accreditationAttested, hasWallet, positionCount } = props;

  if (kycStatus === "rejected") {
    return {
      eyebrow: "Verification",
      headline: "Your verification needs attention.",
      detail:
        "Investor Relations will reach out with the next step. You can review your details in the meantime.",
      cta: { label: "Review profile", href: "/profile" },
    };
  }

  if (!accreditationAttested) {
    return {
      eyebrow: "Get started",
      headline: "Confirm your eligibility to begin.",
      detail: "A few short attestations unlock access to the vault.",
      cta: { label: "Start onboarding", href: "/onboarding/accreditation" },
    };
  }

  if (kycStatus !== "approved") {
    return {
      eyebrow: "Verification in progress",
      headline: "We're reviewing your verification.",
      detail:
        "This usually completes within a business day. No action is needed from you right now.",
    };
  }

  if (!hasWallet) {
    return {
      eyebrow: "One step left",
      headline: "Connect your wallet to invest.",
      detail:
        "Your wallet is used to fund and receive payouts. You'll confirm every transaction yourself.",
      cta: { label: "Connect wallet", href: "/onboarding/wallet" },
    };
  }

  if (positionCount === 0) {
    return {
      eyebrow: "You're ready",
      headline: "Make your first investment.",
      detail: "Review the term sheet and confirm before depositing.",
      cta: { label: "Explore the vault", href: "/vaults" },
    };
  }

  return {
    eyebrow: "All set",
    headline: "Your portfolio is ready.",
    detail: "Track deposits, withdrawals and payouts below, and verify the proofs any time.",
    cta: { label: "Invest more", href: "/vaults" },
  };
}

export function NextActionCard(props: NextActionCardProps) {
  const step = resolveNextStep(props);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{step.eyebrow}</span>
          <p className="h3 ct-text-strong">{step.headline}</p>
          {step.detail ? (
            <p className="body-sm ct-text-muted max-w-prose">{step.detail}</p>
          ) : null}
        </div>
        {step.cta ? (
          <div className="shrink-0">
            <Button variant="primary" size="lg" asChild>
              <Link href={step.cta.href}>{step.cta.label} →</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
