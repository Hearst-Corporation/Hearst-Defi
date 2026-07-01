import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { StrategyLabClient } from "@/components/admin/strategies/strategy-lab-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  PRODUCT_STRATEGIES,
  validateStrategySet,
} from "@/lib/product-strategies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy Lab — Hearst Connect",
};

export default async function StrategyLabPage() {
  await requireAdmin();

  const strategies = PRODUCT_STRATEGIES;
  const active = strategies.filter((s) => s.status === "active").length;
  const drafts = strategies.filter((s) => s.status === "draft").length;
  const violations = validateStrategySet(strategies);

  return (
    <AdminPageShell titleLead="Strategy" titleAccent="Lab" contextLabel="Strategy">
      {/* KPI summary strip */}
      <AdminSectionCard
        ariaLabel="Strategy lab overview"
        kpiTitle="Strategy Library"
        kpiSubtitle="Data scientist environment — allocations, projections, backtests, stress tests, trigger analytics."
        kpis={[
          {
            label: "Strategies",
            value: String(strategies.length),
            sublabel: "in library",
            provenance: "manual",
          },
          {
            label: "Active",
            value: String(active),
            sublabel: "selectable",
            provenance: "manual",
          },
          {
            label: "Drafts",
            value: String(drafts),
            sublabel: "not selectable",
            provenance: "manual",
          },
          {
            label: "Validation",
            value:
              violations.length === 0
                ? "All valid"
                : `${violations.length} issue(s)`,
            sublabel: "rules",
            provenance: "manual",
            ...(violations.length === 0 ? { accent: true } : { alert: true }),
          },
        ]}
      />

      {/* Client lab — receives serialized strategies */}
      <StrategyLabClient strategies={strategies} />
    </AdminPageShell>
  );
}
