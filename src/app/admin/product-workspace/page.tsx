import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { ConstructionStepper } from "@/components/admin/product-workspace/construction-stepper";
import { Heading } from "@/components/catalyst/heading";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

interface ProductWorkspacePageProps {
  searchParams: Promise<{
    autostart?: string;
    objective?: string;
    intent?: string;
  }>;
}

const MAX_OBJECTIVE_LEN = 220;

function sanitizeObjective(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

/**
 * Product Workspace — full-page streamed construction.
 *
 * Recoded A→Z (Pass 1): no left/right column split, no precomputed cards. The
 * page frames the objective and mounts a single full-page vertical stepper where
 * five named specialists (Bitcoin · Hashprice · Mining Infra · DeFi · Data
 * Scientist) stream their real work, in order, as each finishes. Read-only: no
 * vault is created, sent, or deployed from this surface.
 */
export default async function ProductWorkspacePage({
  searchParams,
}: ProductWorkspacePageProps) {
  await requireAdmin();
  const params = await searchParams;
  const objective = sanitizeObjective(params.objective);

  return (
    <AdminPageShell titleLead="Product" titleAccent="Workspace" contextLabel="Strategy">
      <AdminSectionCard
        ariaLabel="Objective"
        title="Objective"
        subtitle="Framing captured from the cockpit agent — read-only documentation."
      >
        <div className="flex flex-col gap-2 p-5">
          <Heading level={3} className={cn("text-balance", !objective && "italic opacity-[var(--ct-opacity-40)]")}>
            {objective ?? "Awaiting objective from the cockpit agent"}
          </Heading>
          <p className="ct-metric-caption leading-relaxed">
            Five specialists construct a read-only draft from live data — nothing is
            created, sent, or deployed here.
          </p>
        </div>
      </AdminSectionCard>

      {/* Full-page stepper — no column split. */}
      <div className="px-1 pt-2">
        <ConstructionStepper objective={objective ?? null} />
      </div>
    </AdminPageShell>
  );
}
