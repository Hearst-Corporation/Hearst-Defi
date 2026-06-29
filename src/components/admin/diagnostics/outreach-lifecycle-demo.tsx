import type {
  OutreachLifecyclePath,
  OutreachLifecycleReport,
} from "@/lib/admin/diagnostics/outreach-lifecycle";

const VERDICT_CLS: Record<OutreachLifecyclePath["verdict"], string> = {
  SAFE: "text-[var(--ct-accent)]",
  GATED: "text-[var(--ct-status-warning)]",
  UNSAFE: "text-[var(--ct-status-danger)]",
};

function Bool({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span
      className={on ? "text-[var(--ct-status-warning)]" : "text-[var(--ct-accent)]"}
    >
      {on ? yes : no}
    </span>
  );
}

function PathCard({ path }: { path: OutreachLifecyclePath }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--ct-text-strong)]">
          {path.path}
        </p>
        <span className={`text-xs font-bold ${VERDICT_CLS[path.verdict]}`}>
          {path.verdict}
        </span>
      </div>

      <p className="text-xs text-[var(--ct-text-secondary)]">
        <span className="ct-bento-label">Trigger</span> · {path.trigger}
      </p>

      <div>
        <span className="ct-bento-label">Guard sequence</span>
        <ol className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--ct-text-secondary)]">
          {path.guardSequence.map((g, i) => (
            <li key={g} className="flex items-center gap-1">
              <span className="rounded-md border border-[var(--ct-border)] px-2 py-0.5">
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

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--ct-text-muted)]">
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

      <p className="text-xs text-[var(--ct-text-tertiary)]">
        Diagnostic: {path.diagnostic}
      </p>
      <p className="font-mono text-xs text-[var(--ct-text-faint)] break-all">
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-[var(--ct-border)] bg-surface-card px-4 py-2.5 font-mono text-xs text-[var(--ct-text-muted)]">
        <span>
          Mode: <span className="text-[var(--ct-accent)]">{report.mode}</span>
        </span>
        <span>
          External send:{" "}
          <span className="text-[var(--ct-accent)]">
            {String(report.externalSend)}
          </span>
        </span>
        <span>
          Resend called:{" "}
          <span className="text-[var(--ct-accent)]">
            {String(report.resendCalled)}
          </span>
        </span>
        <span>
          Inngest triggered:{" "}
          <span className="text-[var(--ct-accent)]">
            {String(report.inngestTriggered)}
          </span>
        </span>
        <span>
          Overall:{" "}
          <span
            className={
              report.ok
                ? "text-[var(--ct-accent)]"
                : "text-[var(--ct-status-danger)]"
            }
          >
            {report.ok ? "SAFE" : "UNSAFE — regression"}
          </span>
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.paths.map((p) => (
          <PathCard key={p.id} path={p} />
        ))}
      </div>
    </div>
  );
}
