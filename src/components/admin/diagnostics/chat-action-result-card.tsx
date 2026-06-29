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

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="ct-bento-label w-32 shrink-0">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-xs text-[var(--ct-text-secondary)] break-all"
            : "text-xs text-[var(--ct-text-secondary)]"
        }
      >
        {children}
      </span>
    </div>
  );
}

function Flag({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span
      className={
        on
          ? "text-[var(--ct-status-warning)]"
          : "text-[var(--ct-accent)]"
      }
    >
      {on ? yes : no}
    </span>
  );
}

/**
 * One scenario rendered as a legible card (not raw JSON): prompt, expected vs
 * actual, routing source, LLM used, page/action, writes/records, send, HITL,
 * verdict, likely source.
 */
export function ChatActionResultCard({ result }: { result: ChatActionResult }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--ct-text-strong)]">
          {result.prompt}
        </p>
        <span className={`text-xs font-bold ${VERDICT_CLS[result.verdict]}`}>
          {result.verdict}
        </span>
      </div>

      <Row label="Role">{result.role}</Row>
      <Row label="Expected">{result.expected}</Row>
      <Row label="Actual">
        <span className="text-[var(--ct-text-strong)]">{result.actual}</span>
      </Row>
      <Row label="Routing source">
        <span className="text-[var(--ct-accent)]">
          {SOURCE_LABEL[result.routingSource]}
        </span>
      </Row>
      <Row label="LLM used?">
        <Flag on={result.llmUsed} yes="yes" no="no" />
      </Row>
      <Row label="Page / action" mono>
        {result.pageOrAction}
      </Row>
      <Row label="Writes">
        {result.writes.length === 0 ? (
          <span className="text-[var(--ct-accent)]">none</span>
        ) : (
          result.writes.join(", ")
        )}
      </Row>
      <Row label="Records">
        {result.records.length === 0 ? (
          <span className="text-[var(--ct-accent)]">none</span>
        ) : (
          result.records.join(", ")
        )}
      </Row>
      <Row label="External send">
        <Flag on={result.externalSend} yes="yes" no="no" />
      </Row>
      <Row label="HITL">
        <Flag on={result.hitl} yes="required" no="not required" />
      </Row>
      <Row label="Likely source" mono>
        {result.likelySource}
      </Row>

      {result.mismatches.length > 0 ? (
        <div className="mt-1 rounded-lg border border-[var(--ct-status-danger)] px-3 py-2">
          <span className="ct-bento-label text-[var(--ct-status-danger)]">
            Mismatches
          </span>
          <ul className="mt-1 list-disc pl-4 text-xs text-[var(--ct-text-secondary)]">
            {result.mismatches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
