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
    <div className="grid grid-cols-[minmax(0,var(--ct-space-32))_minmax(0,1fr)] items-baseline gap-(--ct-space-3)">
      <span className="ct-bento-label">{label}</span>
      <span
        className={cn(
          "text-[length:var(--ct-text-xs)] ct-text-secondary",
          mono && "mono break-all",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function Flag({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className={on ? "ct-status-warning" : "ct-text-accent"}>
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
    <div className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <div className="flex items-center justify-between gap-(--ct-space-3)">
        <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
          {result.prompt}
        </p>
        <span className={cn("text-[length:var(--ct-text-xs)] font-bold", VERDICT_CLS[result.verdict])}>
          {result.verdict}
        </span>
      </div>

      <Row label="Role">{result.role}</Row>
      <Row label="Expected">{result.expected}</Row>
      <Row label="Actual">
        <span className="ct-text-strong">{result.actual}</span>
      </Row>
      <Row label="Routing source">
        <span className="ct-text-accent">
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
          <span className="ct-text-accent">none</span>
        ) : (
          result.writes.join(", ")
        )}
      </Row>
      <Row label="Records">
        {result.records.length === 0 ? (
          <span className="ct-text-accent">none</span>
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
        <div className="mt-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-status-danger)] px-(--ct-space-3) py-(--ct-space-2)">
          <span className="ct-bento-label ct-status-danger">
            Mismatches
          </span>
          <ul className="mt-(--ct-space-1) list-disc pl-(--ct-space-4) text-[length:var(--ct-text-xs)] ct-text-secondary">
            {result.mismatches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
