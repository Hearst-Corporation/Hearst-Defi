// Admin · Agentic Control Center v0 — read-only visibility into the agentic chain.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders a static inventory only. It executes no tool,
// creates no confirmation token, performs no write, and touches no DB or LLM.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  StatusBadge,
  RiskBadge,
  FlagBadge,
} from "@/components/admin/agentic/status-badge";
import {
  getRouterStatusSummary,
  getAgenticInventory,
  getHumanGateInventory,
  getToolBoundarySummary,
  getPromptMap,
  getSafetySummary,
} from "@/lib/agentic/control-center";

export const dynamic = "force-static";
export const metadata = { title: "Agentic Control Center — Hearst Connect" };

function PathList({ paths }: { paths: string[] }) {
  return (
    <ul className="flex flex-col gap-[var(--ct-space-1)]">
      {paths.map((p) => (
        <li
          key={p}
          className="body-xs ct-text-faint tabular-nums break-all font-mono"
        >
          {p}
        </li>
      ))}
    </ul>
  );
}

export default function AgenticControlCenterPage() {
  const router = getRouterStatusSummary();
  const inventory = getAgenticInventory();
  const gates = getHumanGateInventory();
  const boundary = getToolBoundarySummary();
  const promptMap = getPromptMap();
  const safety = getSafetySummary();

  return (
    <>
      <AdminPageHeader
        titleLead="Agentic"
        titleAccent="Control Center"
        contextLabel="Agentic Control Center · read-only v0"
      />

      {/* System status -------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="System status">
        <h2 className="h2">System status</h2>
        <p className="body-xs ct-text-muted">
          A read-only map of every agent, router, tool, guard, and human gate in
          the platform — what exists, where its prompt lives, what it may write,
          and what can never be autonomous. This page runs nothing.
        </p>
        <div className="admin-doc-card-grid-3">
          {safety.map((s) => (
            <Card
              key={s.id}
              hoverOverlay={false}
              contentClassName="flex flex-col gap-[var(--ct-space-2)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <Badge variant={s.holds ? "success" : "danger"}>
                  {s.holds ? "PASS" : "REVIEW"}
                </Badge>
                <span className="flex-1" />
              </div>
              <h3 className="h3 m-0">{s.claim}</h3>
              <p className="body-xs ct-text-muted">{s.evidence}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Router --------------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Router status">
        <div className="admin-doc-inline-row admin-doc-inline-row--start">
          <h2 className="h2 m-0">Router</h2>
          <Badge variant={router.deterministicRouterExists ? "success" : "default"}>
            {router.version}
          </Badge>
        </div>
        <p className="body-xs ct-text-muted">
          Deterministic classification runs <em>before</em> the LLM. Active paths
          act on control flow; shadow paths are classified for visibility but
          stay behind HITL.
        </p>
        <div className="admin-doc-card-grid-3">
          {router.routerPaths.map((p) => (
            <Card
              key={p.id}
              hoverOverlay={false}
              contentClassName="flex flex-col gap-[var(--ct-space-2)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <Badge
                  variant={
                    p.mode === "active"
                      ? "success"
                      : p.mode === "shadow"
                        ? "warning"
                        : "default"
                  }
                >
                  {p.mode}
                </Badge>
                <span className="flex-1" />
              </div>
              <h3 className="h3 m-0">{p.label}</h3>
              <p className="body-xs ct-text-muted">{p.notes}</p>
            </Card>
          ))}
        </div>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <span className="stat-label ct-text-muted">Legacy fallback</span>
          <p className="body-xs ct-text-muted">{router.legacyFallback.notes}</p>
          <span className="stat-label ct-text-faint">Source files</span>
          <PathList paths={router.paths} />
        </Card>
      </section>

      {/* Agents & logic inventory --------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Agents and logic inventory">
        <h2 className="h2">Agents &amp; logic inventory ({inventory.length})</h2>
        <p className="body-xs ct-text-muted">
          Every agent / logic that exists in code, with its source-of-truth path,
          status, write capability, and whether a human gate protects it.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {inventory.map((item) => (
            <Card
              key={item.id}
              hoverOverlay={false}
              contentClassName="flex h-full flex-col gap-[var(--ct-space-3)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
                <h3 className="h3 m-0">{item.name}</h3>
                <span className="flex-1" />
                <Badge variant="default">{item.type}</Badge>
              </div>
              <span className="stat-label ct-text-muted">{item.domain}</span>
              <p className="body-xs ct-text-muted grow">{item.notes}</p>
              <div className="flex flex-wrap gap-[var(--ct-space-2)]">
                <StatusBadge status={item.status} />
                <RiskBadge risk={item.riskLevel} />
                <FlagBadge
                  on={item.writesAllowed}
                  onLabel="writes"
                  offLabel="no writes"
                  onIsSafe={false}
                />
                <FlagBadge
                  on={item.humanGateRequired}
                  onLabel="human gate"
                  offLabel="no gate"
                  onIsSafe
                />
              </div>
              <PathList paths={item.paths} />
            </Card>
          ))}
        </div>
      </section>

      {/* Tool boundary -------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Tool boundary">
        <h2 className="h2">Tool boundary</h2>
        <p className="body-xs ct-text-muted">
          What the model may call — and what it can never do. Read tools are
          unconfirmed; everything that writes is a draft behind a two-step HITL
          token; the bottom tier is unreachable from the chat.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {boundary.map((b) => (
            <Card
              key={b.category}
              hoverOverlay={false}
              contentClassName="flex h-full flex-col gap-[var(--ct-space-3)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <h3 className="h3 m-0">{b.label}</h3>
                <span className="flex-1" />
                <Badge
                  variant={
                    b.category === "read-only"
                      ? "success"
                      : b.category === "forbidden-autonomous"
                        ? "danger"
                        : "warning"
                  }
                >
                  {b.requiresConfirmation ? "HITL" : "open"}
                </Badge>
              </div>
              <ul className="flex flex-col gap-[var(--ct-space-1)]">
                {b.items.map((it) => (
                  <li key={it} className="body-xs ct-text-body">
                    · {it}
                  </li>
                ))}
              </ul>
              <p className="body-xs ct-text-muted">{b.notes}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Human gates ---------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Human gates">
        <h2 className="h2">Human gates ({gates.length})</h2>
        <p className="body-xs ct-text-muted">
          Critical actions that must never be autonomous. Every one is
          <span className="ct-text-strong"> autonomousAllowed = false</span>,
          admin-gated, and confirmation-bound.
        </p>
        <div className="admin-doc-card-grid-3">
          {gates.map((g) => (
            <Card
              key={g.id}
              hoverOverlay={false}
              contentClassName="flex h-full flex-col gap-[var(--ct-space-2)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <h3 className="h3 m-0">{g.action}</h3>
                <span className="flex-1" />
                <Badge variant={g.autonomousAllowed ? "danger" : "success"}>
                  {g.autonomousAllowed ? "AUTONOMOUS" : "gated"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-[var(--ct-space-2)]">
                {g.requiresAdmin && <Badge variant="accent">admin</Badge>}
                {g.requiresConfirmation && <Badge variant="warning">confirm</Badge>}
              </div>
              <p className="body-xs ct-text-muted grow">{g.notes}</p>
              <PathList paths={g.paths} />
            </Card>
          ))}
        </div>
      </section>

      {/* Prompt map ----------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Prompt map">
        <h2 className="h2">Prompt map</h2>
        <p className="body-xs ct-text-muted">
          Where the system prompts, agent prompts, canvas guidance, and textual
          guards live. Paths + summaries only — full prompt bodies stay out of
          the UI.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {promptMap.map((pm) => (
            <Card
              key={pm.id}
              hoverOverlay={false}
              contentClassName="flex h-full flex-col gap-[var(--ct-space-2)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <h3 className="h3 m-0">{pm.label}</h3>
                <span className="flex-1" />
                <Badge variant="default">{pm.kind}</Badge>
              </div>
              <p className="body-xs ct-text-muted grow">{pm.summary}</p>
              <PathList paths={pm.paths} />
            </Card>
          ))}
        </div>
      </section>

      {/* Next architecture steps ---------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Next architecture steps">
        <h2 className="h2">Next architecture steps</h2>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <ul className="flex flex-col gap-[var(--ct-space-2)] body-xs ct-text-muted">
            <li>
              · Wire live run signals (LlmRun + AdminToolRun counts) into each
              inventory card so status reflects real activity, not just static
              wiring.
            </li>
            <li>
              · Surface the active vs shadow router decision per recent turn
              (read-only trace), once the router/guard stabilization lands.
            </li>
            <li>
              · Add a per-gate &quot;last invoked / last confirmed&quot; read-only
              timeline from the audit log.
            </li>
          </ul>
          <p className="body-xs ct-text-faint">
            Out of scope for v0: no crew runtime, no tool execution, no write, no
            live DB traces, no prompt editing, no deploy console.
          </p>
        </Card>
      </section>
    </>
  );
}
