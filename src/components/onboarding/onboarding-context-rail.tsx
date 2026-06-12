import Link from "next/link";

import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { IrContact } from "@/lib/ir-contact";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding/state";
import type { VaultProduct } from "@/lib/data/vaults";
import { cn } from "@/lib/cn";

interface OnboardingContextRailProps {
  activeStep: OnboardingStepId;
  state: OnboardingState;
  vault: VaultProduct | null;
  irContact: IrContact | null;
}

export function OnboardingContextRail({
  activeStep,
  state,
  vault,
  irContact,
}: OnboardingContextRailProps) {
  const showVault = state.accreditationAttested && vault != null;

  return (
    <aside className="onboarding-rail flex flex-col gap-6">
      <StepProgressBar active={activeStep} />

      <Card className="flex flex-col gap-4">
        <p className="eyebrow ct-text-muted m-0">Requirements</p>
        <ul className="m-0 flex flex-col gap-2 p-0 list-none">
          {state.checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
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
                  <Badge variant="default" className="ml-2 align-middle">
                    Optional
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {showVault && vault ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow ct-text-muted m-0">Product</p>
            <ProvenanceBadge kind="live" />
          </div>
          <p className="h3 m-0">{vault.name}</p>
          <p className="body-xs ct-text-muted m-0 tabular">{vault.ticker}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ApyRange low={vault.apyLow} high={vault.apyHigh} />
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="body-xs ct-text-faint m-0 tabular">
            Min {vault.minTicketUsdc.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            {" · "}
            {vault.softLockupDays}-day soft lock-up
          </p>
        </Card>
      ) : null}

      {irContact ? (
        <OpsContactCard
          name={irContact.name}
          title={irContact.title}
          email={irContact.email}
          calendlyHref={irContact.calendlyHref}
        />
      ) : null}

      <p className="body-xs ct-text-faint m-0 text-pretty">
        Projections are estimates based on stated assumptions — not guaranteed.
        This is not a solicitation of investment.
      </p>

      <Link
        href="/portfolio"
        className="body-xs ct-text-muted no-underline hover:ct-text-primary transition-colors"
      >
        Exit to portfolio →
      </Link>
    </aside>
  );
}
