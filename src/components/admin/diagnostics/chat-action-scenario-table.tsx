import { cn } from "@/lib/cn";
import type { ChatActionResult } from "@/lib/admin/diagnostics/chat-action-lab";

const VERDICT_CLS: Record<ChatActionResult["verdict"], string> = {
  PASS: "ct-text-accent",
  WARN: "ct-status-warning",
  FAIL: "ct-status-danger",
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
    <div className="overflow-x-auto rounded-(--ct-radius-xl) border border-[var(--ct-border)]">
      <table className="w-full text-left text-[length:var(--ct-text-xs)]">
        <thead className="ct-bento-label">
          <tr>
            {HEADS.map((h) => (
              <th
                key={h}
                className="px-(--ct-space-3) py-(--ct-space-2) font-semibold whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.id}
              className="border-t border-[var(--ct-border)] align-top"
            >
              <td className={cn("px-(--ct-space-3) py-(--ct-space-2) font-bold", VERDICT_CLS[r.verdict])}>
                {r.verdict}
              </td>
              <td className="px-(--ct-space-3) py-(--ct-space-2) ct-text-strong">
                {r.prompt}
              </td>
              <td className="px-(--ct-space-3) py-(--ct-space-2) ct-text-muted">
                {r.expected}
              </td>
              <td className="px-(--ct-space-3) py-(--ct-space-2) ct-text-muted">
                {r.actual}
              </td>
              <td className="px-(--ct-space-3) py-(--ct-space-2) ct-text-accent whitespace-nowrap">
                {SOURCE_LABEL[r.routingSource]}
              </td>
              <td className={cn("px-(--ct-space-3) py-(--ct-space-2)", r.llmUsed ? "ct-status-warning" : "ct-text-accent")}>
                {r.llmUsed ? "yes" : "no"}
              </td>
              <td className={cn("px-(--ct-space-3) py-(--ct-space-2)", r.writes.length ? "ct-status-warning" : "ct-text-accent")}>
                {r.writes.length === 0 ? "none" : r.writes.join(", ")}
              </td>
              <td className={cn("px-(--ct-space-3) py-(--ct-space-2)", r.externalSend ? "ct-status-danger" : "ct-text-accent")}>
                {r.externalSend ? "yes" : "no"}
              </td>
              <td className="px-(--ct-space-3) py-(--ct-space-2) ct-text-muted">
                {r.hitl ? "required" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
