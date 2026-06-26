// Admin · Agentic Control Tower — shared collapsible record group (presentational).
//
// READ-ONLY. The core primitive for the rewritten console: a native
// <details>/<summary> disclosure (zero JS) with a tokenised summary row
// (caret + title + count/meta) and a body slot. Used by every section so the
// page reads as one consistent stack of collapsible tables/lines.

import type { ReactNode } from "react";

export type AgenticTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "neutral";

/** A collapsible section. `defaultOpen` keeps the most operational groups open. */
export function AgenticGroup({
  id,
  title,
  count,
  meta,
  note,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  count?: number | string;
  meta?: ReactNode;
  note?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} className="agentic-group" open={defaultOpen}>
      <summary className="agentic-group-summary">
        <span className="agentic-caret" aria-hidden />
        <h2 className="agentic-group-title m-0">{title}</h2>
        <span className="agentic-group-meta">
          {meta}
          {count !== undefined && (
            <span className="agentic-group-count tabular-nums">{count}</span>
          )}
        </span>
      </summary>
      <div className="agentic-group-body">
        {note && <p className="agentic-group-note m-0">{note}</p>}
        {children}
      </div>
    </details>
  );
}

/** A tokenised inline tag (status / tier / capability). */
export function AgenticTag({
  tone = "neutral",
  children,
}: {
  tone?: AgenticTone;
  children: ReactNode;
}) {
  return (
    <span className="agentic-tag" data-tone={tone === "neutral" ? undefined : tone}>
      {children}
    </span>
  );
}
