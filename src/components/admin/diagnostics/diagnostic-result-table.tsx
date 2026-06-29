import type { DiagnosticResult } from "@/lib/admin/diagnostics/types";

const STATUS: Record<DiagnosticResult["status"], { label: string; cls: string }> = {
  pass: { label: "PASS", cls: "text-[var(--ct-accent)]" },
  fail: { label: "FAIL", cls: "text-red-400" },
  warn: { label: "WARN", cls: "text-amber-400" },
  skipped: { label: "SKIP", cls: "text-zinc-500" },
};

const SEV: Record<DiagnosticResult["severity"], string> = {
  P0: "text-red-400",
  P1: "text-orange-400",
  P2: "text-amber-400",
  INFO: "text-sky-400",
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
                <td className="px-3 py-2 text-zinc-100">
                  {r.label}
                  {r.guard ? (
                    <span className="block text-[10px] text-zinc-500">
                      guard: {r.guard}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.expected}</td>
                <td className="px-3 py-2 text-zinc-400">{r.actual}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">
                  {r.likelyFile}
                  {r.likelyFunction ? ` · ${r.likelyFunction}` : ""}
                </td>
                <td className="px-3 py-2 text-zinc-500">{r.sideEffect}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
