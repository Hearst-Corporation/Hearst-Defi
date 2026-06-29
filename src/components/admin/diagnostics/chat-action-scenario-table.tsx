import type { ChatActionResult } from "@/lib/admin/diagnostics/chat-action-lab";

const VERDICT_CLS: Record<ChatActionResult["verdict"], string> = {
  PASS: "text-[var(--ct-accent)]",
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
          {results.map((r) => (
            <tr
              key={r.id}
              className="border-t border-[var(--ct-border)] align-top"
            >
              <td className={`px-3 py-2 font-bold ${VERDICT_CLS[r.verdict]}`}>
                {r.verdict}
              </td>
              <td className="px-3 py-2 text-[var(--ct-text-strong)]">
                {r.prompt}
              </td>
              <td className="px-3 py-2 text-[var(--ct-text-muted)]">
                {r.expected}
              </td>
              <td className="px-3 py-2 text-[var(--ct-text-muted)]">
                {r.actual}
              </td>
              <td className="px-3 py-2 text-[var(--ct-accent)] whitespace-nowrap">
                {SOURCE_LABEL[r.routingSource]}
              </td>
              <td
                className={`px-3 py-2 ${r.llmUsed ? "text-[var(--ct-status-warning)]" : "text-[var(--ct-accent)]"}`}
              >
                {r.llmUsed ? "yes" : "no"}
              </td>
              <td
                className={`px-3 py-2 ${r.writes.length ? "text-[var(--ct-status-warning)]" : "text-[var(--ct-accent)]"}`}
              >
                {r.writes.length === 0 ? "none" : r.writes.join(", ")}
              </td>
              <td
                className={`px-3 py-2 ${r.externalSend ? "text-[var(--ct-status-danger)]" : "text-[var(--ct-accent)]"}`}
              >
                {r.externalSend ? "yes" : "no"}
              </td>
              <td className="px-3 py-2 text-[var(--ct-text-muted)]">
                {r.hitl ? "required" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
