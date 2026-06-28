import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgentBriefLive } from "@/components/admin/product-workspace/agent-brief-live";
import { BentoHeader, BentoPanel } from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Product"
          titleAccent="Workspace"
          contextLabel="Strategy"
        />

        <BentoPanel>
          <BentoHeader title="Objective" />
          <div className="flex flex-col gap-2 p-5">
            {/* display value — intentionally p, not a document heading */}
            <p
              className={cn(
                "text-[22px] font-medium leading-tight tracking-tight text-balance",
                objective ? "text-white" : "italic text-zinc-500",
              )}
            >
              {objective ?? "Awaiting objective from cockpit agent"}
            </p>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              Framing and documentation only — no vault creation, allocations, or
              approvals from this surface.
            </p>
          </div>
        </BentoPanel>

        <BentoPanel aria-labelledby="pw-agent-brief-heading">
          <BentoHeader
            title={<span id="pw-agent-brief-heading">Agent framing brief</span>}
          />
          <div className="p-5">
            <AgentBriefLive
              objective={objective ?? null}
              autostart={autostart}
              initialBrief={initialBrief}
            />
          </div>
        </BentoPanel>
      </div>
    </div>
  );
}
