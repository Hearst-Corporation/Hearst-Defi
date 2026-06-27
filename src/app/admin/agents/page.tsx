// Admin · Agents — reusable agent persona templates (the library).
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgentGraphCanvas } from "@/components/admin/agents/agent-graph-canvas";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { loadAgentGraphViews } from "@/lib/data/agent-graph";
import { loadAgentTemplates } from "@/lib/data/agent-templates";
import { ArchiveTemplateButton } from "@/components/admin/archive-template-button";
import {
  BentoPanel,
  BentoHeader,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Agent"
          titleAccent="Operations"
          contextLabel="Agent Operations"
          actions={
            <Link href="/admin/agents/new" className={BENTO_PRIMARY_BTN}>
              New template
            </Link>
          }
        />

        {kpiStrip.length > 0 && <AdminKpiStripPanel kpis={kpiStrip} />}

        {/* ── Agent orchestration ───────────────────────────────────────── */}
        <BentoPanel aria-label="Agent orchestration">
          <BentoHeader
            title="Agent orchestration"
            subtitle="Live wiring across orchestration, the Master Agent chat pipeline, and every bounded instrument it can call. Particles flow on edges that just ran; bound surfaces pulse by live state. Auto-refreshes."
            trailing={
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full bg-[#A7FB90]"
                    aria-hidden
                  />
                  Active
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full bg-zinc-600"
                    aria-hidden
                  />
                  Idle
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full bg-red-400"
                    aria-hidden
                  />
                  Failed
                </span>
              </div>
            }
          />
          <div className="p-5 lg:p-6">
            <AgentGraphCanvas initialViews={agentGraphViews} />
          </div>
        </BentoPanel>

        {/* ── Base agents ───────────────────────────────────────────────── */}
        <BentoPanel aria-label="Base agents">
          <BentoHeader
            title="Base agents"
            subtitle="The code agents running across the platform. Pick one to start a new persona template on top of it — without changing the agent itself."
          />
          <div className="p-5 lg:p-6 flex flex-col gap-y-6">
            {catalogGroups.map((group) => (
              <div key={group.scope} className="flex flex-col gap-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
                    {group.scopeLabel}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-600 tabular-nums">
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
                        <div className="h-full min-h-[13rem] flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#15191C] p-5 transition-colors hover:border-[#A7FB90]/40">
                          {/* Header row: accent icon tile + scope badge */}
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]"
                            >
                              <Icon className="size-6" strokeWidth={2} />
                            </span>
                            <span className="flex-1" />
                            <span
                              className={
                                entry.scope === "platform"
                                  ? "inline-flex items-center rounded-md border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A7FB90]"
                                  : "inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                              }
                            >
                              {entry.scopeLabel}
                            </span>
                          </div>

                          {/* Title + surface */}
                          <div className="flex flex-col gap-1">
                            <h3 className="text-[15px] font-medium text-white m-0">
                              {entry.label}
                            </h3>
                            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
                              {entry.surface}
                            </span>
                          </div>

                          <p className="text-[12px] text-zinc-400 leading-relaxed grow">
                            {entry.description}
                          </p>

                          {/* Footer affordance — quiet at rest, lights up on hover */}
                          <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-zinc-600 transition-colors group-hover:text-[#A7FB90]">
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
        </BentoPanel>

        {/* ── Persona templates ─────────────────────────────────────────── */}
        <BentoPanel aria-label="Persona templates">
          <BentoHeader
            title={`Persona templates (${templates.length})`}
            subtitle="Reusable persona profiles layered on top of a base agent — assignable across investor accounts. Customer-level overrides still take precedence when set."
          />

          {templates.length === 0 ? (
            <div className="p-5 lg:p-6">
              <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#15191C] p-8 text-center">
                <p className="text-[13px] font-medium text-zinc-300">
                  No persona templates yet.
                </p>
                <p className="text-[12px] text-zinc-500">
                  Pick a base agent above to create your first reusable persona —
                  tone, language, and register.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 w-[28%]">
                      Label
                    </th>
                    <th className="hidden px-5 py-3 text-left text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 md:table-cell md:w-[20%]">
                      Base agent
                    </th>
                    <th className="hidden px-5 py-3 text-left text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 lg:table-cell lg:w-[22%]">
                      Register
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 w-[12%]">
                      Used by
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 w-[18%]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4 align-top text-white">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/agents/${t.id}`}
                            className="text-[13px] font-medium text-white hover:underline"
                          >
                            {t.label}
                          </Link>
                          {t.archived && (
                            <span className="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                              Archived
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[12px] text-zinc-500 truncate">
                            {t.description}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 align-top text-[13px] text-zinc-400 md:table-cell">
                        {BASE_AGENT_LABELS[t.baseAgent as BaseAgent] ??
                          t.baseAgent}
                      </td>
                      <td className="hidden px-5 py-4 align-top text-[13px] text-zinc-300 lg:table-cell">
                        {[t.tone, t.language, t.verbosity]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-5 py-4 align-top text-right text-[13px] tabular-nums text-zinc-300">
                        {t.usageCount}
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/agents/${t.id}`}
                            className={BENTO_SECONDARY_BTN}
                          >
                            Edit
                          </Link>
                          <ArchiveTemplateButton
                            id={t.id}
                            archived={t.archived}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BentoPanel>
      </div>
    </div>
  );
}
