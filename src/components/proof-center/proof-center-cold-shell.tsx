import Link from "next/link";

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { Card } from "@/components/catalyst/card";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { PORTFOLIO_ONBOARDING_INVEST_HREF } from "@/lib/portfolio/layout-preview";
import { ShieldCheck, Zap, BarChart3, FileText, Lock } from "lucide-react";

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
    title: "Accumulation & events",
    detail: "BTC accumulation, rebalances, and the on-chain event log.",
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
  const stackClass = variant === "admin" ? "proof-center-cold admin-doc-stack admin-doc-stack--roomy" : "proof-center-cold product-doc-stack product-doc-stack--roomy";

  return (
    <div
      className={stackClass}
      data-testid="proof-center-cold-shell"
    >
      <Card material="flat" hoverOverlay={false} contentClassName="proof-cold-card">
        <div className="flex items-start gap-4">
          <div className="proof-dataroom-icon-box mt-1">
            <Lock className="w-4 h-4 ct-text-muted" />
          </div>
          <div className={variant === "admin" ? "admin-doc-stack admin-doc-stack--tight" : "product-doc-stack product-doc-stack--tight"}>
            <div className="flex items-center gap-2">
              <p className="eyebrow m-0">Status</p>
              <Badge variant="accent">Active</Badge>
            </div>
            <h2 className="h3 m-0">Proof system active — awaiting vault activity</h2>
            <PanelStatus
              message={
                chainConfigured
                  ? "Contracts are deployed on a test network. Attestations, settlement events, and event logs publish once the vault operates."
                  : "On-chain proof modules activate after deployment. Off-chain documents publish as operations posts them."
              }
            />
          </div>
        </div>
        {variant === "product" ? (
          <Button asChild variant="primary" size="md" className="proof-cold-cta no-underline mt-2">
            <Link href={PORTFOLIO_ONBOARDING_INVEST_HREF}>Explore products</Link>
          </Button>
        ) : null}
      </Card>

      <Card material="flat" hoverOverlay={false} contentClassName="proof-cold-card proof-cold-card--list">
        <p className="stat-label m-0">What unlocks when the vault operates</p>
        <ul className="proof-cold-list">
          {UNLOCKS.map((item) => (
            <li key={item.title} className="proof-cold-list__item">
              <div className="flex items-center gap-2">
                <item.icon className="w-3.5 h-3.5 ct-text-muted" />
                <span className="proof-cold-list__title body-sm text-foreground">{item.title}</span>
              </div>
              <span className="body-xs ct-text-muted ml-5">{item.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
