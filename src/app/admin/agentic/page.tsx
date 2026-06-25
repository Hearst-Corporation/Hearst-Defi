// Admin · Agentic Control Center v0.1 — read-only visibility into the agentic chain.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders the STATIC registry plus a LIVE, read-only Router
// Observability section. It executes no tool, creates no confirmation token,
// performs no write, and runs no LLM. The registry comes from
// getAgenticControlCenterData() (pure); the observability summary is a read-only
// fetch of recent router-decision metadata (no user text — see ROUTER_OBSERVABILITY_V0.md).

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  StatusBadge,
  RiskBadge,
  FlagBadge,
} from "@/components/admin/agentic/status-badge";
import { RouterObservabilitySection } from "@/components/admin/agentic/router-observability-section";
import { ToolBoundarySection } from "@/components/admin/agentic/tool-boundary-section";
import { ReportingCrewSection } from "@/components/admin/agentic/reporting-crew-section";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import { getReportingCrewBriefing } from "@/lib/agentic/reporting";
import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";

// Dynamic: the Router Observability section reads live (read-only) recent router
// decisions at request time. The static registry sections are still pure.
export const dynamic = "force-dynamic";
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

/** One small status pill in the System Status banner. */
function SystemStatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  return (
    <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
      <span className="stat-label ct-text-muted">{label}</span>
      <div className="admin-doc-inline-row admin-doc-inline-row--start">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{
            background:
              tone === "ok"
                ? "var(--ct-accent)"
                : tone === "warn"
                  ? "var(--ct-status-warning)"
                  : "var(--ct-text-faint)",
          }}
        />
        <span className="body-xs ct-text-strong">{value}</span>
      </div>
    </Card>
  );
}

export default async function AgenticControlCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ routerWindow?: string }>;
}) {
  const data = getAgenticControlCenterData();
  const {
    router,
    inventory,
    gates,
    tools,
    toolBoundaryV1,
    prompts,
    safetySummary,
    nextSteps,
  } = data;
  // Read-only: durable router-decision metadata for the selected time window.
  // Best-effort — getRouterObservabilitySummary never throws; a backend hiccup
  // degrades to an honest empty/unavailable state rather than breaking the page.
  const sp = await searchParams;
  const routerWindow = resolveWindow(sp.routerWindow);
  const observability = await getRouterObservabilitySummary({
    window: routerWindow,
  }).catch(() => null);

  // Reporting Crew Read-Only v0 — deterministic briefing composed from the data
  // above (control-center registry + the SAME observability summary, reused so we
  // don't issue a second read). Best-effort: getReportingCrewBriefing never throws.
  const reportingCrew = await getReportingCrewBriefing({ observability }).catch(
    () => null,
  );

  return (
    <>
      <AdminPageHeader
        titleLead="Agentic"
        titleAccent="Control Center"
        contextLabel={`Agentic Control Center · static registry ${data.version} / read-only`}
      />

      {/* 1. System status ---------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="System status">
        <h2 className="h2">System status</h2>
        <p className="body-xs ct-text-muted">
          A read-only map of every agent, router, tool, guard, and human gate in
          the platform — what exists, where its prompt lives, what it may write,
          and what can never be autonomous. This page runs nothing: static
          registry {data.version}, no live telemetry.
        </p>
        <div className="admin-doc-card-grid-3">
          <SystemStatusChip label="Router" value="Active · non-shadow" tone="ok" />
          <SystemStatusChip label="HITL" value="Enabled on every write" tone="ok" />
          <SystemStatusChip label="Compliance guard" value="Active" tone="ok" />
          <SystemStatusChip label="Writes" value="Gated (draft + HITL)" tone="ok" />
          <SystemStatusChip label="Autonomous criticals" value="None reachable" tone="ok" />
          <SystemStatusChip
            label="External swarms"
            value="Not connected"
            tone="muted"
          />
        </div>
      </section>

      {/* 2. Router ------------------------------------------------------ */}
      <section className="admin-doc-stack" aria-label="Router status">
        <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
          <h2 className="h2 m-0">Router</h2>
          <Badge variant={router.status === "active" ? "success" : "default"}>
            {router.version} · {router.mode}
          </Badge>
          <span className="flex-1" />
          <Badge variant={router.release.lotStatus === "closed" ? "success" : "warning"}>
            lot {router.release.lotStatus}
          </Badge>
        </div>
        <p className="body-xs ct-text-muted">
          Deterministic classification runs <em>before</em> the LLM. Active paths
          act on control flow; shadow paths are not built / not connected.
        </p>

        {/* Verbatim Router Status block (lot close) -------------------- */}
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
            <span className="stat-label ct-text-muted">Router status</span>
            <span className="flex-1" />
            <Badge variant={router.shadowFlag.alive ? "danger" : "success"}>
              {router.shadowFlag.name} {router.shadowFlag.alive ? "alive" : "dead"}
            </Badge>
          </div>
          <pre className="body-xs ct-text-body font-mono whitespace-pre-wrap m-0">
            {router.statusBlock.join("\n")}
          </pre>
          <p className="body-xs ct-text-faint">{router.shadowFlag.notes}</p>
        </Card>

        {/* Release / validation strip --------------------------------- */}
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
            <span className="stat-label ct-text-muted">Router stabilization — release</span>
            <span className="flex-1" />
            <Badge variant="default">merge {router.release.mergeCommit} ({router.release.mergePr})</Badge>
            <Badge variant="default">
              lock {router.release.lockReleaseCommit} ({router.release.lockReleasePr})
            </Badge>
            <Badge variant={router.release.vercel === "ready" ? "success" : "warning"}>
              Vercel {router.release.vercel}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-[var(--ct-space-2)]">
            {router.release.validations.map((v) => (
              <Badge key={v.id} variant={v.pass ? "success" : "danger"}>
                {v.label}: {v.result}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Guard handoff assertions ----------------------------------- */}
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <span className="stat-label ct-text-muted">
            Guard handoff — not relaxed by the router
          </span>
          <ul className="flex flex-col gap-[var(--ct-space-1)]">
            {router.guardAssertions.map((a) => (
              <li key={a.id} className="admin-doc-inline-row admin-doc-inline-row--start">
                <Badge variant={a.holds ? "success" : "danger"}>
                  {a.holds ? "PASS" : "REVIEW"}
                </Badge>
                <span className="body-xs ct-text-body flex-1">
                  <span className="ct-text-strong">{a.label}</span>
                  <span className="ct-text-muted"> — {a.evidence}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

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
          <span className="stat-label ct-text-muted">Educational steering</span>
          <p className="body-xs ct-text-muted">{router.educationalSteering}</p>
          <span className="stat-label ct-text-muted">Dangerous-intent policy</span>
          <p className="body-xs ct-text-muted">{router.dangerousIntentPolicy}</p>
          <span className="stat-label ct-text-muted">Legacy fallback</span>
          <p className="body-xs ct-text-muted">{router.legacyFallback.notes}</p>
          <span className="stat-label ct-text-faint">Source files</span>
          <PathList paths={router.paths} />
        </Card>
      </section>

      {/* 3. Agents & logic inventory ----------------------------------- */}
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

      {/* 4. Tool boundary ---------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Tool boundary">
        <h2 className="h2">Tool boundary</h2>
        <p className="body-xs ct-text-muted">
          What the model may call — and what it can never do. Read tools are
          unconfirmed; everything that writes is a draft behind a two-step HITL
          token; the bottom tier is unreachable from the chat.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {tools.map((b) => (
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
                  <li key={it} className="body-xs ct-text-body font-mono break-all">
                    · {it}
                  </li>
                ))}
              </ul>
              <p className="body-xs ct-text-muted">{b.notes}</p>
            </Card>
          ))}
        </div>

        {/* Tool Boundary v1 — read-only reflection of the real registry ids,
            with per-tool tier/gate/risk + static-vs-code consistency warnings. */}
        <ToolBoundarySection summary={toolBoundaryV1} />
      </section>

      {/* 5. Human gates ------------------------------------------------ */}
      <section className="admin-doc-stack" aria-label="Human gates">
        <h2 className="h2">Human gates ({gates.length})</h2>
        <p className="body-xs ct-text-muted">
          Critical actions that must never be autonomous. Every one is{" "}
          <span className="ct-text-strong">autonomousAllowed = false</span>,
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
                <RiskBadge risk={g.riskLevel} />
                {g.requiresAdmin && <Badge variant="accent">admin</Badge>}
                {g.requiresConfirmation && <Badge variant="warning">confirm</Badge>}
              </div>
              <p className="body-xs ct-text-muted grow">{g.notes}</p>
              <PathList paths={g.paths} />
            </Card>
          ))}
        </div>
      </section>

      {/* 6. Prompt map ------------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Prompt map">
        <h2 className="h2">Prompt map</h2>
        <p className="body-xs ct-text-muted">
          Where the system prompts, agent prompts, canvas guidance, and textual
          guards live. Paths + summaries only — full prompt bodies stay out of
          the UI and are <span className="ct-text-strong">not editable here</span>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {prompts.map((pm) => (
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
              <span className="stat-label ct-text-faint">read-only · not editable</span>
            </Card>
          ))}
        </div>
      </section>

      {/* 7. Compliance / Guards ---------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Compliance and guards">
        <h2 className="h2">Compliance / Guards</h2>
        <p className="body-xs ct-text-muted">
          The output-side guards that run on every human-facing surface. The
          router&apos;s educational steering is prompt-only and never relaxes any
          of these.
        </p>
        <div className="admin-doc-card-grid-3">
          <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
            <Badge variant="success">active</Badge>
            <h3 className="h3 m-0">Forbidden words</h3>
            <p className="body-xs ct-text-muted">
              guarantee / promise / certain / will deliver / risk-free hard-blocked
              (FR∪EN). No intent exemption.
            </p>
            <PathList paths={["src/lib/agents/forbidden-words.ts"]} />
          </Card>
          <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
            <Badge variant="success">active</Badge>
            <h3 className="h3 m-0">APY range</h3>
            <p className="body-xs ct-text-muted">
              Single-point headline APY blocked; only genuine ranges + per-source
              attribution pass. Universal, not intent-based.
            </p>
            <PathList paths={["src/lib/agents/apy-range.ts"]} />
          </Card>
          <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
            <Badge variant="success">active</Badge>
            <h3 className="h3 m-0">Output guard</h3>
            <p className="body-xs ct-text-muted">
              chatOutputViolation streams compliance before token emission;
              look-back buffer + sentinel abort. No intent parameter.
            </p>
            <PathList paths={["src/lib/llm/output-guard.ts"]} />
          </Card>
        </div>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Educational steering</span>
          <p className="body-xs ct-text-muted">{router.guardPolicy}</p>
        </Card>
      </section>

      {/* 8. Safety summary --------------------------------------------- */}
      <section className="admin-doc-stack" aria-label="Safety summary">
        <h2 className="h2">Safety summary</h2>
        <p className="body-xs ct-text-muted">
          The headline guarantees, each with the repo / ADR evidence behind it.
        </p>
        <div className="admin-doc-card-grid-3">
          {safetySummary.map((s) => (
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

      {/* 9. Router Observability (live, read-only) ---------------------- */}
      <RouterObservabilitySection summary={observability} />

      {/* 9b. Reporting Crew — read-only briefing (first read-only crew) -- */}
      <ReportingCrewSection briefing={reportingCrew} />

      {/* 10. Next architecture steps ----------------------------------- */}
      <section className="admin-doc-stack" aria-label="Next architecture steps">
        <h2 className="h2">Next architecture steps</h2>
        <p className="body-xs ct-text-muted">
          Planned agentic surfaces — none of this is built. Visibility, not a
          promise.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
          {nextSteps.map((n) => (
            <Card
              key={n.id}
              hoverOverlay={false}
              contentClassName="flex flex-col gap-[var(--ct-space-2)]"
            >
              <div className="admin-doc-inline-row admin-doc-inline-row--start">
                <h3 className="h3 m-0">{n.title}</h3>
                <span className="flex-1" />
                <Badge variant="default">{n.status}</Badge>
              </div>
              <p className="body-xs ct-text-muted">{n.why}</p>
            </Card>
          ))}
        </div>
        <p className="body-xs ct-text-faint">
          Out of scope for {data.version}: no crew runtime, no CrewAI / external
          swarms, no tool execution, no write, no live DB traces, no prompt
          editing, no deploy console.
        </p>
      </section>
    </>
  );
}
