import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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
      <Table className="text-[length:var(--ct-text-xs)]">
        <TableHead className="ct-bento-label">
          <TableRow>
            {HEADS.map((h) => (
              <TableHeader key={h} className="font-semibold whitespace-nowrap">
                {h}
              </TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((r) => {
            const s = STATUS[r.status];
            return (
              <TableRow key={r.id} className="align-top">
                <TableCell className={`font-bold ${s.cls}`}>{s.label}</TableCell>
                <TableCell className={`font-bold ${SEV[r.severity]}`}>
                  {r.severity}
                </TableCell>
                <TableCell className="text-[var(--ct-text-strong)]">
                  {r.label}
                  {r.guard ? (
                    <span className="block text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)]">
                      guard: {r.guard}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-[var(--ct-text-muted)]">
                  {r.expected}
                </TableCell>
                <TableCell className="text-[var(--ct-text-muted)]">
                  {r.actual}
                </TableCell>
                <TableCell className="font-mono text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)]">
                  {r.likelyFile}
                  {r.likelyFunction ? ` · ${r.likelyFunction}` : ""}
                </TableCell>
                <TableCell className="text-[var(--ct-text-tertiary)]">
                  {r.sideEffect}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
