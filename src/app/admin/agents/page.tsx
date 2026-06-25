// Admin · Agents — reusable agent persona templates (the library).
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { AgentGraphCanvas } from "@/components/admin/agents/agent-graph-canvas";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { loadAgentGraphViews } from "@/lib/data/agent-graph";
import { loadAgentTemplates } from "@/lib/data/agent-templates";
import { ArchiveTemplateButton } from "@/components/admin/archive-template-button";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { groupCatalogByScope, AGENT_CATALOG } from "@/lib/agents/agent-catalog";
import { AGENT_ICONS } from "@/lib/agents/agent-icons";
import {
  BASE_AGENT_LABELS,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";
import { buildAgentsKpiStrip } from "@/lib/admin/agents-kpi-strip";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agents — Hearst Connect" };

export default async function AgentsPage() {
  const [templates, agentGraphViews] = await Promise.all([
    loadAgentTemplates(),
    loadAgentGraphViews(),
  ]);
  const catalogGroups = groupCatalogByScope();
  // KPI strip derives from the orchestration view (LLM surfaces + their runs).
  const orchestrationNodes =
    agentGraphViews.views.find((v) => v.id === "orchestration")?.nodes ?? [];
  const kpiStrip = buildAgentsKpiStrip({
    templates,
    nodes: orchestrationNodes,
    baseAgentCount: AGENT_CATALOG.length,
  });

  return (
    <>
      <AdminPageHeader
        titleLead="Agent"
        titleAccent="Operations"
        contextLabel="Agent Operations"
        actions={
          <Button asChild variant="primary" size="md">
            <Link href="/admin/agents/new">New template</Link>
          </Button>
        }
      />

      {kpiStrip.length > 0 && <AdminKpiStripPanel kpis={kpiStrip} />}

      <section className="admin-doc-stack admin-crm-view" aria-label="Agent orchestration">
        <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-3)]">
          <h2 className="h2">Agent orchestration</h2>
          <div className="flex flex-wrap items-center gap-[var(--ct-space-3)] body-xs ct-text-muted">
            <span className="inline-flex items-center gap-[var(--ct-space-1_5)]">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-accent)]" aria-hidden />
              Active
            </span>
            <span className="inline-flex items-center gap-[var(--ct-space-1_5)]">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-text-faint)]" aria-hidden />
              Idle
            </span>
            <span className="inline-flex items-center gap-[var(--ct-space-1_5)]">
              <span className="h-2 w-2 rounded-full bg-[var(--ct-status-danger)]" aria-hidden />
              Failed
            </span>
          </div>
        </div>
        <p className="body-xs ct-text-muted">
          Live wiring of the agents across three views — orchestration, the
          Master Agent chat pipeline, and every bounded instrument it can call.
          Particles flow on edges that just ran; bound surfaces pulse by live
          state (LlmRun + AdminToolRun) while static wiring stays neutral.
          Auto-refreshes; click a node for its provenance + runtime.
        </p>
        <Card hoverOverlay={false} className="overflow-hidden p-[var(--ct-space-4)] sm:p-[var(--ct-space-5)]">
          <AgentGraphCanvas initialViews={agentGraphViews} />
        </Card>
      </section>

      <section className="admin-doc-stack" aria-label="Base agents">
        <h2 className="h2">Base agents</h2>
        <p className="body-xs ct-text-muted">
          The code agents running across the platform. Pick one to start a new
          persona template on top of it — without changing the agent itself.
        </p>

        {catalogGroups.map((group) => (
          <div key={group.scope} className="admin-doc-stack">
            <div className="admin-doc-inline-row admin-doc-inline-row--start">
              <span className="stat-label ct-text-muted">{group.scopeLabel}</span>
              <span className="stat-label ct-text-faint tabular-nums">
                {group.entries.length}
              </span>
            </div>

            <div className="admin-doc-card-grid-3">
              {group.entries.map((entry) => {
                const Icon = AGENT_ICONS[entry.icon];
                return (
                  <Link
                    key={entry.baseAgent}
                    href={`/admin/agents/new?base=${entry.baseAgent}`}
                    aria-label={`New persona template from ${entry.label}`}
                    className="block h-full"
                  >
                    <Card
                      className="h-full min-h-[13rem] cursor-pointer ct-transition-base group-hover:border-[var(--ct-border-accent)]"
                      contentClassName="flex h-full flex-col gap-[var(--ct-space-4)]"
                    >
                      {/* Header row: accent icon tile + scope badge */}
                      <div className="admin-doc-inline-row admin-doc-inline-row--start">
                        <span
                          aria-hidden
                          className="flex size-12 shrink-0 items-center justify-center rounded-[var(--ct-radius-md)] border border-[var(--ct-border-accent)] bg-[var(--ct-accent-soft)] ct-text-accent"
                        >
                          <Icon className="size-6" strokeWidth={2} />
                        </span>
                        <span className="flex-1" />
                        <Badge variant={entry.scope === "platform" ? "accent" : "default"}>
                          {entry.scopeLabel}
                        </Badge>
                      </div>

                      {/* Title + surface */}
                      <div className="flex flex-col gap-[var(--ct-space-1)]">
                        <h3 className="h3 m-0">{entry.label}</h3>
                        <span className="stat-label ct-text-muted">{entry.surface}</span>
                      </div>

                      <p className="body-xs ct-text-muted grow">{entry.description}</p>

                      {/* Footer affordance — quiet at rest, lights up on hover */}
                      <span className="admin-doc-inline-row admin-doc-inline-row--start body-xs font-semibold ct-text-faint ct-transition-base group-hover:ct-text-accent">
                        New template
                        <ArrowRight
                          className="size-4 ct-transition-base group-hover:translate-x-[var(--ct-space-1)]"
                          aria-hidden
                          strokeWidth={2.25}
                        />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="admin-doc-stack" aria-label="Persona templates">
        <h2 className="h2">Persona templates ({templates.length})</h2>
        <p className="body-xs ct-text-muted">
          Reusable persona profiles layered on top of a base agent — assignable
          across investor accounts. Customer-level overrides still take
          precedence when set.
        </p>

        {templates.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No persona templates yet."
            detail="Pick a base agent above to create your first reusable persona — tone, language, and register."
            className="min-h-32"
          />
        ) : (
          <AdminTable
            data={templates}
            headers={[
              "Label",
              <span key="base" className="hidden md:inline">Base agent</span>,
              <span key="register" className="hidden lg:inline">Register</span>,
              <span key="used" className="text-right">Used by</span>,
              <span key="actions" className="text-right">Actions</span>,
            ]}
            colWidths={[
              "w-[28%]",
              "hidden w-[20%] md:table-cell",
              "hidden w-[22%] lg:table-cell",
              "w-[12%] text-right",
              "w-[18%] text-right",
            ]}
            renderRow={(t) => (
              <>
                <td className="ct-table-cell ct-text-strong">
                  <div className="admin-doc-inline-row">
                    <Link href={`/admin/agents/${t.id}`} className="hover:underline">
                      {t.label}
                    </Link>
                    {t.archived && <Badge variant="warning">Archived</Badge>}
                  </div>
                  {t.description && (
                    <p className="body-xs ct-text-muted truncate">{t.description}</p>
                  )}
                </td>
                <td className="hidden ct-table-cell ct-text-muted md:table-cell">
                  {BASE_AGENT_LABELS[t.baseAgent as BaseAgent] ?? t.baseAgent}
                </td>
                <td className="hidden ct-table-cell ct-text-body lg:table-cell">
                  {[t.tone, t.language, t.verbosity].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="ct-table-cell text-right tabular-nums ct-text-body">{t.usageCount}</td>
                <td className="ct-table-cell text-right">
                  <div className="admin-doc-inline-row justify-end">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/agents/${t.id}`}>Edit</Link>
                    </Button>
                    <ArchiveTemplateButton id={t.id} archived={t.archived} />
                  </div>
                </td>
              </>
            )}
          />
        )}
      </section>
    </>
  );
}
