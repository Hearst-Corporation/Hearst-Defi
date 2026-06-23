import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgentBriefLive } from "@/components/admin/product-workspace/agent-brief-live";
import { Card } from "@/components/ui/card";
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
    <div className="admin-doc-shell--roomy">
      <AdminPageHeader
        titleLead="Product"
        titleAccent="Workspace"
        contextLabel="Strategy"
      />

      <Card hoverOverlay={false} className="admin-doc-card-pad">
        <div className="admin-doc-objective">
          <p className="eyebrow">Objective</p>
          {/* display value — intentionally p.h2, not a document heading */}
          <p
            className={cn(
              "h2 ct-text-strong text-balance",
              !objective && "ct-text-muted italic",
            )}
          >
            {objective ?? "Awaiting objective from cockpit agent"}
          </p>
          <p className="body-sm ct-text-body">
            Framing and documentation only — no vault creation, allocations, or
            approvals from this surface.
          </p>
        </div>
      </Card>

      <section aria-labelledby="pw-agent-brief-heading" className="admin-doc-section">
        <div className="admin-doc-section-heading">
          <span aria-hidden className="admin-doc-section-rule" />
          <h2 id="pw-agent-brief-heading" className="h2">Agent framing brief</h2>
        </div>
        <Card hoverOverlay={false} className="admin-doc-card-pad">
          <AgentBriefLive
            objective={objective ?? null}
            autostart={autostart}
            initialBrief={initialBrief}
          />
        </Card>
      </section>
    </div>
  );
}
