// Admin · Agentic Control Tower — shared tone type.
//
// The collapsible-group + inline-tag components that used to live here were
// removed in Mission #064b: the page moved to the Catalyst Table + BentoBadge
// canon, so `AgenticGroup` and `AgenticTag` are gone. Only the `AgenticTone`
// union survives — it is still imported by the table sections to map a row's
// tone to a BentoBadge variant and the data-tone accent rail.

export type AgenticTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "neutral";
