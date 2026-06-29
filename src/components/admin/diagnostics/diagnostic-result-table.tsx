import type { DiagnosticResult } from "@/lib/admin/diagnostics/types";

const STATUS: Record<DiagnosticResult["status"], { label: string; cls: string }> = {
  pass: { label: "PASS", cls: "text-[var(--ct-accent)]" },
  fail: { label: "FAIL", cls: "text-[var(--ct-status-danger)]" },
  warn: { label: "WARN", cls: "text-[var(--ct-status-warning)]" },
  skipped: { label: "SKIP", cls: "text-[var(--ct-text-tertiary)]" },
};

const SEV: Record<DiagnosticResult["severity"], string> = {
  P0: "text-[var(--ct-status-danger)]",
  P1: "text-[var(--ct-status-warning)]",
  P2: "text-[var(--ct-status-warning)]",
  INFO: "text-[var(--ct-status-info)]",
};

const HEADS = [
  "Status",
  "Sev",
  "Test",
  "Expected",
  "Actual",
  "Likely source",
  "Side effect",
];

export function DiagnosticResultTable({
  results,
}: {
  results: DiagnosticResult[];
}) {
  if (results.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--ct-border)]">
      <table className="w-full text-left text-xs">
        <thead className="ct-bento-label">
          <tr>
            {HEADS.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const s = STATUS[r.status];
            return (
              <tr
                key={r.id}
                className="border-t border-[var(--ct-border)] align-top"
              >
                <td className={`px-3 py-2 font-bold ${s.cls}`}>{s.label}</td>
                <td className={`px-3 py-2 font-bold ${SEV[r.severity]}`}>
                  {r.severity}
                </td>
                <td className="px-3 py-2 text-[var(--ct-text-strong)]">
                  {r.label}
                  {r.guard ? (
                    <span className="block text-xs text-[var(--ct-text-tertiary)]">
                      guard: {r.guard}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-[var(--ct-text-muted)]">
                  {r.expected}
                </td>
                <td className="px-3 py-2 text-[var(--ct-text-muted)]">
                  {r.actual}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--ct-text-tertiary)]">
                  {r.likelyFile}
                  {r.likelyFunction ? ` · ${r.likelyFunction}` : ""}
                </td>
                <td className="px-3 py-2 text-[var(--ct-text-tertiary)]">
                  {r.sideEffect}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
