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
import { analyzeObjectiveQuality } from "@/lib/product-workspace/objective-quality";

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

/** A short, human label for the intent kind carried from the chat. */
const INTENT_LABEL: Record<string, string> = {
  product_creation: "deterministic product intent",
  product_framing: "deterministic product framing",
  mixed_product_creation_simulation:
    "deterministic product + simulation intent",
  mixed_product_framing_simulation:
    "deterministic product framing + simulation intent",
};

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
  const intentKind = params.intent;

  // A persisted brief (from a prior generation for the same objective) lets a
  // refresh re-render without re-billing the model. A different objective in
  // the URL supersedes a stale persisted brief.
  const persistedDraft = await loadProductWorkspaceDraft(admin.userId);
  const initialBrief =
    persistedDraft?.agentBrief && persistedDraft.objective === objective
      ? persistedDraft.agentBrief
      : null;

  // Pure, synchronous: lets the page show an honest routing-source block + an
  // honest Projection CTA without any model call.
  const quality = analyzeObjectiveQuality(objective);
  const briefStatus = !objective
    ? "no objective"
    : initialBrief
      ? "ready (persisted)"
      : quality.tooVague
        ? "too vague fallback"
        : "auto-generating";

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

      {/* Routing source — shows the admin (esp. when testing by hand) whether
          the system reached this page via deterministic/regex routing or an LLM
          fallback, where the objective came from, and the brief status. */}
      <AdminSectionCard ariaLabel="Routing source" title="Routing source">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 p-5 text-xs sm:grid-cols-2">
          <div className="flex items-baseline gap-3">
            <dt className="ct-bento-label w-32 shrink-0">Routing</dt>
            <dd className="text-[var(--ct-accent)]">
              {intentKind && INTENT_LABEL[intentKind]
                ? INTENT_LABEL[intentKind]
                : "deterministic product intent"}{" "}
              <span className="text-[var(--ct-text-tertiary)]">
                (no LLM used to route)
              </span>
            </dd>
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="ct-bento-label w-32 shrink-0">Objective source</dt>
            <dd className="text-[var(--ct-text-secondary)]">
              {autostart ? "cockpit chat" : objective ? "manual / refresh" : "—"}
            </dd>
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="ct-bento-label w-32 shrink-0">Brief status</dt>
            <dd className="text-[var(--ct-text-secondary)]">{briefStatus}</dd>
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="ct-bento-label w-32 shrink-0">Projection handoff</dt>
            <dd className="text-[var(--ct-text-secondary)]">
              {objective ? "available (context-only)" : "objective required"}
            </dd>
          </div>
        </dl>
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
          objective so Projection can show a context block. The label is HONEST
          about brief readiness: a ready brief gets "Continue to Projection"; a
          vague/failed brief gets "Continue anyway" + a note that the projection
          will need manual assumptions with no prefilled numbers. */}
      <AdminSectionCard
        ariaLabel="Continue to Projection"
        title="Next step — Projection"
      >
        <div className="flex flex-col gap-3 p-5">
          <p className="ct-metric-caption leading-relaxed">
            No run is created from this page. Projection requires manual admin
            review.
          </p>
          {objective ? (
            <>
              {quality.tooVague && !initialBrief ? (
                <p className="body-xs ct-text-muted">
                  Projection will require manual assumptions. No numbers will be
                  prefilled.
                </p>
              ) : null}
              <Link
                href={`/admin/projection?objective=${encodeURIComponent(objective)}&from=product-workspace`}
                className={cn(
                  cockpitButtonVariants({
                    variant:
                      quality.tooVague && !initialBrief ? "secondary" : "primary",
                    size: "lg",
                  }),
                  "self-start",
                )}
              >
                {quality.tooVague && !initialBrief
                  ? "Continue anyway"
                  : "Continue to Projection"}
              </Link>
            </>
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
