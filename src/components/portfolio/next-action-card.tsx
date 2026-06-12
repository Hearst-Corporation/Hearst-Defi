import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";

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

  // Active positions imply the investor cleared onboarding — never surface
  // accreditation/KYC/wallet CTAs on top of a live portfolio.
  if (positionCount > 0) {
    return {
      eyebrow: "All set",
      headline: "Your portfolio is ready.",
      detail:
        "Track deposits, withdrawals and payouts below, and verify the proofs any time.",
      cta: { label: "Invest more", href: "/vaults" },
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
      eyebrow: "Institutional Verification",
      headline: "Verification in progress.",
      detail:
        "Our compliance team is reviewing your documentation. This institutional check ensures platform integrity and usually completes within one business day.",
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

  return {
    eyebrow: "You're ready",
    headline: "Make your first investment.",
    detail: "Review the term sheet and confirm before depositing.",
    cta: { label: "Explore the vault", href: "/vaults" },
  };
}

/**
 * Decide whether the "next action" card is shown at all.
 *
 * Product rule: this card is the *onboarding / get-started* surface. The moment
 * an investor holds at least one position they have, by definition, cleared
 * onboarding — surfacing "Confirm your eligibility / Start onboarding" (or even
 * a redundant "ready" CTA) on top of a funded portfolio is contradictory. So we
 * hide the card whenever there are positions, regardless of the session flags
 * (which can lag behind the real on-chain/DB state).
 *
 * It stays visible only for genuinely pre-position investors who still have a
 * step to take, or whose KYC was rejected (handled first in resolveNextStep).
 */
export function shouldShowNextActionCard(props: NextActionCardProps): boolean {
  const { kycStatus, accreditationAttested, hasWallet, positionCount } = props;
  // Rejected KYC always needs attention, even mid-portfolio.
  if (kycStatus === "rejected") return true;
  // Any position ⇒ onboarding is done ⇒ no get-started card.
  if (positionCount > 0) return false;
  // Pre-position: show until accreditation + KYC + wallet are all in place.
  return !(accreditationAttested && kycStatus === "approved" && hasWallet);
}

export function NextActionCard(props: NextActionCardProps) {
  const step = resolveNextStep(props);

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label="Next step"
      className="pf-next-action-card"
    >
      <div className="pf-next-action-card__layout">
        <div className="pf-next-action-card__copy">
          <span className="pf-panel-title">{step.eyebrow}</span>
          <p className="pf-cockpit-panel__title--primary m-0">{step.headline}</p>
          {step.detail ? (
            <p className="body-sm ct-text-muted m-0">{step.detail}</p>
          ) : null}
        </div>
        {step.cta ? (
          <div className="pf-next-action-card__cta">
            <Button variant="primary" size="lg" asChild>
              <Link href={step.cta.href}>{step.cta.label}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </PfCockpitPanel>
  );
}
