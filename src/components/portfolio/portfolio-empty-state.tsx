import type { PortfolioData } from "@/lib/data/portfolio";
import { cn } from "@/lib/cn";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { NextActionCard } from "@/components/portfolio/next-action-card";

/**
 * PortfolioEmptyState — the calm, guided view shown when the investor has NO
 * active positions. "Space is luxury": a single centered column, one dominant
 * action, and no analytical dashboard full of "—" / "Stale" placeholders.
 *
 * Server Component. Pure derivation from already-loaded session/portfolio flags
 * (NO fetch, NO financial logic). The single next action reuses the canonical
 * `resolveNextStep` so the CTA always points at the investor's real next step
 * (accreditation → verification → wallet → vault), keeping one source of truth.
 *
 * Tokens / existing classes only (design-lock respected). No forbidden words.
 */

export interface PortfolioEmptyStateProps {
  /** Display name — email local-part or shortened wallet. */
  name: string;
  /** Already-loaded portfolio data (positions empty in this state). */
  data: PortfolioData;
  /** Investor onboarding flags (already loaded by the page). */
  kycStatus: string;
  accreditationAttested: boolean;
  hasWallet: boolean;
}

/** What the active portfolio will surface — a calm preview, no live data. */
const FUTURE_MODULES: ReadonlyArray<{ label: string; detail: string }> = [
  { label: "Position value", detail: "Principal plus accrued yield, marked daily." },
  { label: "Yield earned", detail: "Accrued and distributed — never projected forward." },
  { label: "Next payout", detail: "Your monthly distribution date and amount." },
  { label: "Proof & methodology", detail: "On-chain reserves and the locked methodology." },
];

function eligibilityLabel(kycStatus: string, accreditationAttested: boolean): string {
  if (kycStatus === "rejected") return "Needs attention";
  if (accreditationAttested && kycStatus === "approved") return "Verified";
  return "Pending";
}

export function PortfolioEmptyState({
  name,
  data,
  kycStatus,
  accreditationAttested,
  hasWallet,
}: PortfolioEmptyStateProps) {
  const statusRow: ReadonlyArray<{ label: string; value: string; done: boolean }> = [
    {
      label: "Eligibility",
      value: eligibilityLabel(kycStatus, accreditationAttested),
      done: accreditationAttested && kycStatus === "approved",
    },
    { label: "Wallet", value: hasWallet ? "Connected" : "Not connected", done: hasWallet },
    { label: "Portfolio", value: "Inactive", done: false },
  ];

  return (
    <div className="pf-empty flex flex-col gap-10">
      {data.source === "fallback" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-(--ct-border-soft) ct-surface-1 px-4 py-2.5"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-(--ct-text-muted)" />
          <p className="body-xs ct-text-muted">
            Preview data — your portfolio appears here after activation.
          </p>
        </div>
      ) : null}

      {/* 1 — Greeting: "Welcome back, {name}" + "No active positions yet." */}
      <PortfolioGreeting name={name} data={data} />

      {/* 2 — The single dominant action card. */}
      <NextActionCard
        kycStatus={kycStatus}
        accreditationAttested={accreditationAttested}
        hasWallet={hasWallet}
        positionCount={0}
      />

      {/* 3 — Discreet status row. */}
      <ul className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Account status">
        {statusRow.map((s) => (
          <li key={s.label} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                s.done ? "bg-(--ct-accent)" : "bg-(--ct-text-faint)",
              )}
            />
            <span className="eyebrow ct-text-muted">{s.label}</span>
            <span className="body-xs ct-text-body truncate">{s.value}</span>
          </li>
        ))}
      </ul>

      {/* 4 — Calm preview — canonical dash-cell bento (same chrome as active portfolio). */}
      <section
        className="dash-cell dash-cell-premium col-12 flex flex-col gap-5"
        aria-label="What your portfolio will show when active"
      >
        <p className="dash-label mb-0">
          <span>When active, your portfolio will show</span>
        </p>
        <ul className="dash-bento">
          {FUTURE_MODULES.map((m) => (
            <li
              key={m.label}
              className="bento-col-6 flex min-w-0 flex-col gap-1 ct-nested-panel px-4 py-3"
            >
              <span className="body-sm ct-text-strong">{m.label}</span>
              <span className="body-xs ct-text-muted">{m.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
