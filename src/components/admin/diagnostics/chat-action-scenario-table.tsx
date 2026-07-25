import { cn } from "@/lib/cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import type { ChatActionResult } from "@/lib/admin/diagnostics/chat-action-lab";

const VERDICT_CLS: Record<ChatActionResult["verdict"], string> = {
  PASS: "ct-text-accent",
  WARN: "text-[var(--ct-status-warning)]",
  FAIL: "text-[var(--ct-status-danger)]",
};

const SOURCE_LABEL: Record<ChatActionResult["routingSource"], string> = {
  deterministic: "deterministic",
  "deterministic-nav": "deterministic (nav)",
  "llm-fallback": "LLM fallback",
};

const HEADS = [
  "Verdict",
  "Prompt",
  "Expected",
  "Actual",
  "Routing source",
  "LLM",
  "Writes",
  "Ext. send",
  "HITL",
];

/** Compact PASS/FAIL overview of every scenario — the scan-the-room view. */
export function ChatActionScenarioTable({
  results,
}: {
  results: ChatActionResult[];
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
          {results.map((r) => (
            <TableRow key={r.id} className="align-top">
              <TableCell className={cn("font-bold", VERDICT_CLS[r.verdict])}>
                {r.verdict}
              </TableCell>
              <TableCell className="ct-text-strong">{r.prompt}</TableCell>
              <TableCell className="ct-text-muted">{r.expected}</TableCell>
              <TableCell className="ct-text-muted">{r.actual}</TableCell>
              <TableCell className="ct-text-accent whitespace-nowrap">
                {SOURCE_LABEL[r.routingSource]}
              </TableCell>
              <TableCell
                className={cn(r.llmUsed ? "text-[var(--ct-status-warning)]" : "ct-text-accent")}
              >
                {r.llmUsed ? "yes" : "no"}
              </TableCell>
              <TableCell
                className={cn(
                  r.writes.length ? "text-[var(--ct-status-warning)]" : "ct-text-accent",
                )}
              >
                {r.writes.length === 0 ? "none" : r.writes.join(", ")}
              </TableCell>
              <TableCell
                className={cn(
                  r.externalSend ? "text-[var(--ct-status-danger)]" : "ct-text-accent",
                )}
              >
                {r.externalSend ? "yes" : "no"}
              </TableCell>
              <TableCell className="ct-text-muted">
                {r.hitl ? "required" : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
