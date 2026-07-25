import { cn } from "@/lib/cn";
import type {
  OutreachLifecyclePath,
  OutreachLifecycleReport,
} from "@/lib/admin/diagnostics/outreach-lifecycle";

const VERDICT_CLS: Record<OutreachLifecyclePath["verdict"], string> = {
  SAFE: "ct-text-accent",
  GATED: "text-[var(--ct-status-warning)]",
  UNSAFE: "text-[var(--ct-status-danger)]",
};

function Bool({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className={on ? "text-[var(--ct-status-warning)]" : "ct-text-accent"}>
      {on ? yes : no}
    </span>
  );
}

function PathCard({ path }: { path: OutreachLifecyclePath }) {
  return (
    <div className="flex flex-col gap-(--ct-space-2) rounded-xl border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <div className="flex items-center justify-between gap-(--ct-space-3)">
        <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
          {path.path}
        </p>
        <span className={cn("text-[length:var(--ct-text-xs)] font-bold", VERDICT_CLS[path.verdict])}>
          {path.verdict}
        </span>
      </div>

      <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-secondary)]">
        <span className="ct-bento-label">Trigger</span> · {path.trigger}
      </p>

      <div>
        <span className="ct-bento-label">Guard sequence</span>
        <ol className="mt-(--ct-space-1) flex flex-wrap items-center gap-(--ct-space-1) text-[length:var(--ct-text-xs)] text-[var(--ct-text-secondary)]">
          {path.guardSequence.map((g, i) => (
            <li key={g} className="flex items-center gap-(--ct-space-1)">
              <span className="rounded-md border border-[var(--ct-border)] px-(--ct-space-2) py-0.5">
                {g}
              </span>
              {i < path.guardSequence.length - 1 ? (
                <span aria-hidden className="text-[var(--ct-text-faint)]">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-x-(--ct-space-5) gap-y-(--ct-space-1) text-[length:var(--ct-text-xs)] ct-text-muted">
        <span>
          Writes? <Bool on={path.wouldWrite} yes="yes" no="no" />
        </span>
        <span>
          External send?{" "}
          <Bool on={path.wouldSendExternal} yes="prod only" no="no" />
        </span>
        <span>
          Blocked by default?{" "}
          <Bool on={!path.blockedByDefault} yes="no" no="yes" />
        </span>
        <span>
          Confirmation?{" "}
          <Bool on={path.requiredConfirmation} yes="required" no="—" />
        </span>
      </div>

      <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)]">
        Diagnostic: {path.diagnostic}
      </p>
      <p className="mono text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] break-all">
        {path.source}
      </p>
    </div>
  );
}

/**
 * Outreach Lifecycle Demo — readable dry-run lens over every send path. No real
 * send; the safety verdicts are derived from the real policy functions.
 */
export function OutreachLifecycleDemo({
  report,
}: {
  report: OutreachLifecycleReport;
}) {
  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <div className="flex flex-wrap items-center gap-x-(--ct-space-5) gap-y-(--ct-space-1) rounded-lg border border-[var(--ct-border)] bg-surface-card px-(--ct-space-4) py-2.5 mono text-[length:var(--ct-text-xs)] ct-text-muted">
        <span>
          Mode: <span className="ct-text-accent">{report.mode}</span>
        </span>
        <span>
          External send:{" "}
          <span className="ct-text-accent">
            {String(report.externalSend)}
          </span>
        </span>
        <span>
          Resend called:{" "}
          <span className="ct-text-accent">
            {String(report.resendCalled)}
          </span>
        </span>
        <span>
          Inngest triggered:{" "}
          <span className="ct-text-accent">
            {String(report.inngestTriggered)}
          </span>
        </span>
        <span>
          Overall:{" "}
          <span className={report.ok ? "ct-text-accent" : "text-[var(--ct-status-danger)]"}>
            {report.ok ? "SAFE" : "UNSAFE — regression"}
          </span>
        </span>
      </div>

      <div className="grid gap-(--ct-space-3) lg:grid-cols-2">
        {report.paths.map((p) => (
          <PathCard key={p.id} path={p} />
        ))}
      </div>
    </div>
  );
}
