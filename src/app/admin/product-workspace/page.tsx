import Link from "next/link";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { AgentBriefLive } from "@/components/admin/product-workspace/agent-brief-live";
import { cockpitButtonVariants } from "@/components/catalyst/cockpit-button";
import { Heading } from "@/components/catalyst/heading";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadProductWorkspaceDraft } from "@/lib/product-workspace/draft";

export const dynamic = "force-dynamic";

interface ProductWorkspacePageProps {
  searchParams: Promise<{
    autostart?: string;
    objective?: string;
    intent?: string;
    secondary?: string;
    secondaryHint?: string;
  }>;
}

const MAX_OBJECTIVE_LEN = 220;

function sanitizeObjective(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

/**
 * Product Workspace — a near-empty chamber the cockpit agent fills.
 *
 * No pre-computed product content (no inferred vault, calc notes, assumptions,
 * scenario outputs, charts): the agent declares and brings the material itself,
 * streamed live into the brief area. The page only frames the objective and
 * mounts the live brief surface; `AgentBriefLive` auto-starts generation when
 * the page was opened by the agent (`autostart`), or renders a persisted brief
 * on a later refresh.
 */
export default async function ProductWorkspacePage({
  searchParams,
}: ProductWorkspacePageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const objective = sanitizeObjective(params.objective);
  const autostart = params.autostart === "1";

  // A persisted brief (from a prior generation for the same objective) lets a
  // refresh re-render without re-billing the model. A different objective in
  // the URL supersedes a stale persisted brief.
  const persistedDraft = await loadProductWorkspaceDraft(admin.userId);
  const initialBrief =
    persistedDraft?.agentBrief && persistedDraft.objective === objective
      ? persistedDraft.agentBrief
      : null;

  return (
    <AdminPageShell
      titleLead="Product"
      titleAccent="Workspace"
      contextLabel="Strategy"
    >
      <AdminSectionCard ariaLabel="Objective" title="Objective">
        <div className="flex flex-col gap-2 p-5">
          {/* display value — intentionally p, not a document heading */}
          <Heading
            level={3}
            className={cn(
              "text-balance",
              !objective && "italic opacity-40",
            )}
          >
            {objective ?? "Awaiting objective from cockpit agent"}
          </Heading>
          <p className="ct-metric-caption leading-relaxed">
            Framing and documentation only — no vault creation, allocations, or
            approvals from this surface.
          </p>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Agent framing brief"
        title={<span id="pw-agent-brief-heading">Agent framing brief</span>}
      >
        <div className="p-5">
          <AgentBriefLive
            objective={objective ?? null}
            autostart={autostart}
            initialBrief={initialBrief}
          />
        </div>
      </AdminSectionCard>

      {/* Handoff CTA — the next step is Projection, where the admin reviews the
          configured assumptions and runs the study MANUALLY. This link never
          runs a study, creates a vault, or promotes a draft: it only carries the
          objective so Projection can show a context block. When no objective was
          received the CTA is disabled with an honest message. */}
      <AdminSectionCard
        ariaLabel="Continue to Projection"
        title="Next step — Projection"
      >
        <div className="flex flex-col gap-3 p-5">
          <p className="ct-metric-caption leading-relaxed">
            Admin only · manual run required · projection, not guaranteed.
            Continue to Projection to review the configured assumptions, then run
            the study yourself. Nothing runs from this page.
          </p>
          {objective ? (
            <Link
              href={`/admin/projection?objective=${encodeURIComponent(objective)}&from=product-workspace`}
              className={cn(
                cockpitButtonVariants({ variant: "primary", size: "lg" }),
                "self-start",
              )}
            >
              Continue to Projection
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                cockpitButtonVariants({ variant: "secondary", size: "lg" }),
                "self-start cursor-not-allowed opacity-40",
              )}
            >
              Continue to Projection — objective required
            </span>
          )}
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
