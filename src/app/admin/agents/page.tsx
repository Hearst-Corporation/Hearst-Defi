// Admin · Agents — reusable agent persona templates (the library).
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import { AgentGraphCanvas } from "@/components/admin/agents/agent-graph-canvas";
import { Badge } from "@/components/catalyst/badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { loadAgentGraphViews } from "@/lib/data/agent-graph";
import { loadAgentTemplates } from "@/lib/data/agent-templates";
import { ArchiveTemplateButton } from "@/components/admin/archive-template-button";
import {
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/catalyst/bento";
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
    <AdminPageShell
      titleLead="Agent"
      titleAccent="Operations"
      contextLabel="Agent Operations"
      headerActions={
        <Link href="/admin/agents/new" className={BENTO_PRIMARY_BTN}>
          New template
        </Link>
      }
    >
      {/* ── Agent orchestration ───────────────────────────────────────── */}
      <AdminSectionCard
        kpis={kpiStrip}
        kpiTitle="Agent Base"
        title="Agent orchestration"
        subtitle="Live wiring across orchestration, the Master Agent chat pipeline, and every bounded instrument it can call. Particles flow on edges that just ran; bound surfaces pulse by live state. Auto-refreshes."
        headerTrailing={
          <div className="flex flex-wrap items-center gap-3 ct-metric-caption">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full bg-[var(--ct-accent)]"
                aria-hidden
              />
              Active
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full bg-[var(--ct-text-faint)]"
                aria-hidden
              />
              Idle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full bg-[var(--ct-status-danger)]"
                aria-hidden
              />
              Failed
            </span>
          </div>
        }
        ariaLabel="Agent orchestration"
      >
        <div className="p-5 lg:p-6">
          <AgentGraphCanvas initialViews={agentGraphViews} />
        </div>
      </AdminSectionCard>

      {/* ── Base agents ───────────────────────────────────────────────── */}
      <AdminSectionCard
        title="Base agents"
        subtitle="The code agents running across the platform. Pick one to start a new persona template on top of it — without changing the agent itself."
        ariaLabel="Base agents"
      >
        <div className="p-5 lg:p-6 flex flex-col gap-y-6">
            {catalogGroups.map((group) => (
              <div key={group.scope} className="flex flex-col gap-y-3">
                <div className="flex items-center gap-3">
                  <span className="ct-bento-label">{group.scopeLabel}</span>
                  <span className="ct-bento-label tabular-nums">
                    {group.entries.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.entries.map((entry) => {
                    const Icon = AGENT_ICONS[entry.icon];
                    return (
                      <Link
                        key={entry.baseAgent}
                        href={`/admin/agents/new?base=${entry.baseAgent}`}
                        aria-label={`New persona template from ${entry.label}`}
                        className="group block h-full"
                      >
                        <div className="h-full min-h-[13rem] flex flex-col gap-4 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5 transition-colors hover:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)]">
                          {/* Header row: accent icon tile + scope badge */}
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                            >
                              <Icon className="size-6" strokeWidth={2} />
                            </span>
                            <span className="flex-1" />
                            <span
                              className={
                                entry.scope === "platform"
                                  ? "ct-bento-label inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-2 py-0.5 text-[var(--ct-accent)]"
                                  : "ct-bento-label inline-flex items-center rounded-md border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-2 py-0.5"
                              }
                            >
                              {entry.scopeLabel}
                            </span>
                          </div>

                          {/* Title + surface */}
                          <div className="flex flex-col gap-1">
                            <h3 className="ct-panel-title m-0 text-[var(--ct-text-strong)]">
                              {entry.label}
                            </h3>
                            <span className="ct-bento-label">{entry.surface}</span>
                          </div>

                          <p className="ct-metric-caption leading-relaxed grow">
                            {entry.description}
                          </p>

                          {/* Footer affordance — quiet at rest, lights up on hover */}
                          <span className="ct-metric-caption inline-flex items-center gap-2 font-semibold transition-colors group-hover:text-[var(--ct-accent)]">
                            New template
                            <ArrowRight
                              className="size-4 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                              strokeWidth={2.25}
                            />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
      </AdminSectionCard>

      {/* ── Persona templates ─────────────────────────────────────────── */}
      <AdminSectionCard
        title={`Persona templates (${templates.length})`}
        subtitle="Reusable persona profiles layered on top of a base agent — assignable across investor accounts. Customer-level overrides still take precedence when set."
        ariaLabel="Persona templates"
      >
          {templates.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No persona templates yet."
              detail="Pick a base agent above to create your first reusable persona — tone, language, and register."
              className="min-h-32"
            />
          ) : (
            <Table dense className={TABLE_WRAP}>
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5 w-[28%]`}>
                    Label
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden md:table-cell md:w-[20%]`}
                  >
                    Base agent
                  </TableHeader>
                  <TableHeader
                    className={`${TABLE_HEAD} hidden lg:table-cell lg:w-[22%]`}
                  >
                    Register
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right w-[12%]`}>
                    Used by
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right w-[18%]`}>
                    Actions
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id} className={ROW}>
                    <TableCell className="pl-5 align-top">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/agents/${t.id}`}
                          className="ct-metric-value hover:underline"
                        >
                          {t.label}
                        </Link>
                        {t.archived && (
                          <Badge color="amber" className="uppercase">
                            Archived
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="ct-metric-caption truncate">
                          {t.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden align-top md:table-cell">
                      {BASE_AGENT_LABELS[t.baseAgent as BaseAgent] ??
                        t.baseAgent}
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden align-top lg:table-cell">
                      {[t.tone, t.language, t.verbosity]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="ct-metric-value align-top text-right tabular-nums">
                      {t.usageCount}
                    </TableCell>
                    <TableCell className="pr-5 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/agents/${t.id}`}
                          className={BENTO_SECONDARY_BTN}
                        >
                          Edit
                        </Link>
                        <ArchiveTemplateButton id={t.id} archived={t.archived} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </AdminSectionCard>
    </AdminPageShell>
  );
}
