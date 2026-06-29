import type { DiagnosticSuiteResult } from "@/lib/admin/diagnostics/types";

function health(result: DiagnosticSuiteResult | undefined): {
  label: string;
  cls: string;
} {
  if (!result) return { label: "Not run", cls: "text-zinc-500" };
  if (result.summary.fail > 0) return { label: "Failing", cls: "text-red-400" };
  if (result.summary.warn > 0)
    return { label: "Warning", cls: "text-amber-400" };
  return { label: "Healthy", cls: "text-[var(--ct-accent)]" };
}

export function DiagnosticRunCard({
  label,
  blurb,
  result,
  loading,
  active,
  onRun,
  onSelect,
}: {
  label: string;
  blurb: string;
  result: DiagnosticSuiteResult | undefined;
  loading: boolean;
  active: boolean;
  onRun: () => void;
  onSelect: () => void;
}) {
  const h = health(result);
  const s = result?.summary;
  return (
    <div
      onClick={onSelect}
      className={`flex cursor-pointer flex-col rounded-xl border bg-surface-card p-4 transition-colors ${
        active
          ? "border-[var(--ct-accent)]"
          : "border-[var(--ct-border)] hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-100">{label}</span>
        <span className={`text-[11px] font-bold ${h.cls}`}>
          {loading ? "Running…" : h.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">{blurb}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-zinc-400">
          {s
            ? `${s.pass}/${s.total} pass${s.fail ? ` · ${s.fail} fail` : ""}${
                s.warn ? ` · ${s.warn} warn` : ""
              }${s.skipped ? ` · ${s.skipped} skip` : ""}`
            : "—"}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          disabled={loading}
          className="rounded-md border border-[var(--ct-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--ct-accent)] transition-colors hover:bg-[var(--ct-accent)]/10 disabled:opacity-50"
        >
          {loading ? "…" : "Run suite"}
        </button>
      </div>
    </div>
  );
}
