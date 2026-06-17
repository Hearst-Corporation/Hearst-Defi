// Admin · Agents — reusable agent persona templates (the library).
// Server Component — inherits the /admin layout's requireAdmin() gate.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { AgentDiceCanvas } from "@/components/admin/agents/agent-dice-canvas";
import { loadAgentPulses } from "@/lib/data/agent-pulse";
import { loadAgentTemplates } from "@/lib/data/agent-templates";
import { ArchiveTemplateButton } from "@/components/admin/archive-template-button";
import { groupCatalogByScope } from "@/lib/agents/agent-catalog";
import { AGENT_ICONS } from "@/lib/agents/agent-icons";
import {
  BASE_AGENT_LABELS,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agents — Hearst Connect" };

export default async function AgentsPage() {
  const [templates, agentPulses] = await Promise.all([
    loadAgentTemplates(),
    loadAgentPulses(),
  ]);
  const catalogGroups = groupCatalogByScope();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Agents"
        description="Govern reusable agent templates and review the base execution surfaces they can inherit."
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/agents/new">New template</Link>
          </Button>
        }
      />

      <section className="admin-doc-stack" aria-label="Agent activity">
        <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-3)]">
          <h2 className="h2">Agent activity</h2>
          <div className="flex flex-wrap items-center gap-[var(--ct-space-3)] body-xs ct-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-(--ct-accent)" aria-hidden />
              Active
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-(--ct-text-faint)" aria-hidden />
              Idle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-(--ct-status-danger)" aria-hidden />
              Failed
            </span>
          </div>
        </div>
        <p className="body-xs ct-text-muted">
          Live pulse of each base agent — derived from its most recent run.
          Brighter, faster dice mean recent activity; idle agents drift quietly.
        </p>
        <Card hoverOverlay={false} className="overflow-hidden p-[var(--ct-space-4)] sm:p-[var(--ct-space-5)]">
          <AgentDiceCanvas pulses={agentPulses} />
        </Card>
      </section>

      <section className="admin-doc-stack" aria-label="Base agents">
        <h2 className="h2">Base agents</h2>
        <p className="body-xs ct-text-muted">
          The code agents running across the platform. Pick one to start a new
          persona template on top of it — without changing the agent itself.
        </p>

        {catalogGroups.map((group) => (
          <div key={group.scope} className="admin-doc-stack admin-doc-stack--actions">
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
                      className="h-full min-h-[13rem] cursor-pointer ct-transition-base group-hover:border-(--ct-border-accent)"
                      contentClassName="flex h-full flex-col gap-[var(--ct-space-4)]"
                    >
                      {/* Header row: accent icon tile + scope badge */}
                      <div className="admin-doc-inline-row admin-doc-inline-row--start">
                        <span
                          aria-hidden
                          className="flex size-12 shrink-0 items-center justify-center rounded-[var(--ct-radius-md)] border border-(--ct-border-accent) bg-(--ct-accent-soft) ct-text-accent"
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
                        <h4 className="h4 ct-text-strong m-0">{entry.label}</h4>
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

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Persona templates">
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
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[28%] stat-label ct-table-header whitespace-nowrap">Label</th>
                    <th className="hidden w-[20%] stat-label ct-table-header whitespace-nowrap md:table-cell">Base agent</th>
                    <th className="hidden w-[22%] stat-label ct-table-header whitespace-nowrap lg:table-cell">Register</th>
                    <th className="w-[12%] stat-label ct-table-header whitespace-nowrap text-right">Used by</th>
                    <th className="w-[18%] stat-label ct-table-header whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-(--ct-border-soft) last:border-0">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
