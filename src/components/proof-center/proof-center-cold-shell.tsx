import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PORTFOLIO_ONBOARDING_INVEST_HREF } from "@/lib/portfolio/layout-preview";
import { ShieldCheck, Zap, BarChart3, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

const UNLOCKS = [
  {
    title: "Proof of Reserves",
    detail: "On-chain attestation after the first vault period closes.",
    icon: ShieldCheck,
  },
  {
    title: "Mining cash-flow",
    detail: "Partner revenue coverage and calibration inputs.",
    icon: Zap,
  },
  {
    title: "Distributions & events",
    detail: "USDC payouts, rebalances, and the on-chain event log.",
    icon: BarChart3,
  },
  {
    title: "Off-chain proofs",
    detail: "Audits, custody snapshots, and methodology documents.",
    icon: FileText,
  },
] as const;

/** Compact cold proof center — primary CTA + secondary unlock list (no fake charts).
 *  The "Explore products" CTA is investor-only; the operator (admin) view omits it. */
export function ProofCenterColdShell({
  chainConfigured,
  variant = "product",
}: {
  chainConfigured: boolean;
  variant?: "product" | "admin";
}) {
  const stackClass = variant === "admin" ? "admin-doc-stack admin-doc-stack--relaxed" : "proof-center-cold product-doc-stack product-doc-stack--roomy";
  const Container = variant === "admin" ? "div" : Card;

  return (
    <div
      className={stackClass}
      data-testid="proof-center-cold-shell"
    >
      <Container {...(variant === "admin" ? { className: "admin-doc-stack admin-doc-stack--tight" } : { material: "flat", hoverOverlay: false, contentClassName: "proof-cold-card" })}>
        <div className="flex items-start gap-(--ct-space-4)">
          {variant === "admin" ? null : (
            <div className="proof-dataroom-icon-box mt-1">
              <Lock className="w-4 h-4 ct-text-muted" />
            </div>
          )}
          <div className={variant === "admin" ? "admin-doc-stack admin-doc-stack--tight" : "product-doc-stack product-doc-stack--tight"}>
            <p className="eyebrow m-0">Status</p>
            <h2 className={cn("m-0", variant === "admin" ? "h3 ct-text-strong" : "h3")}>Proof system active — awaiting vault activity</h2>
            <p className="body-sm ct-text-muted m-0">
              {chainConfigured
                ? "Contracts are deployed on a test network. Attestations, distributions, and event logs publish once the vault operates."
                : "On-chain proof modules activate after deployment. Off-chain documents publish as operations posts them."}
            </p>
          </div>
        </div>
        {variant === "product" ? (
          <Link
            href={PORTFOLIO_ONBOARDING_INVEST_HREF}
            className="proof-cold-cta ct-bg-accent ct-text-on-accent ct-bg-accent-strong-hover ct-transition-base ct-focus-ring ct-press no-underline mt-(--ct-space-2)"
          >
            Explore products
          </Link>
        ) : null}
      </Container>

      <Container {...(variant === "admin" ? { className: "admin-doc-stack admin-doc-stack--tight" } : { material: "flat", hoverOverlay: false, contentClassName: "proof-cold-card proof-cold-card--list" })}>
        <p className="stat-label m-0">What unlocks when the vault operates</p>
        <ul className="proof-cold-list">
          {UNLOCKS.map((item) => (
            <li key={item.title} className="proof-cold-list__item">
              <div className="flex items-center gap-(--ct-space-2)">
                <item.icon className="w-3.5 h-3.5 ct-text-muted" />
                <span className="proof-cold-list__title body-sm ct-text-primary">{item.title}</span>
              </div>
              <span className="body-xs ct-text-muted ml-(--ct-space-5_5)">{item.detail}</span>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
