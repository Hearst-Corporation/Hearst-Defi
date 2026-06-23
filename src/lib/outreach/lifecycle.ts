/**
 * Outreach prospect lifecycle — the single, pure mapping from the stored
 * `OutreachProspect.status` to a human stage label + ordering + outcome kind.
 *
 * Pure: no DB, no IO. Used by the CRM prospect sheet to render an HONEST
 * lifecycle indicator (where this lead actually is) and reusable by any
 * surface that needs to label a status without re-deriving the vocabulary.
 *
 * Status vocabulary (mirrors prisma/schema.prisma OutreachProspect.status):
 *   new | contacted | opened | replied | qualified | converted | opted_out | bounced
 *
 * Conceptual journey (ADR-016 outreach engine):
 *   new/sourced → (enriched, scored, tiered, drafted) → contacted → opened
 *   → replied → qualified → converted          [happy path]
 *                         ↘ opted_out / bounced [terminal — lost]
 *
 * "enriched / scored / drafted" are NOT separate status values — they are
 * derived facts (apolloData present, qualScore present, a draft email exists).
 * The status field only advances once an email is actually sent (contacted).
 */

/** Outcome family for a status — drives colour + whether the lead is still live. */
export type LifecycleKind = "pending" | "active" | "won" | "lost";

export interface LifecycleStage {
  /** The canonical status string. */
  status: string;
  /** Short human label for the UI. */
  label: string;
  /** Outcome family. */
  kind: LifecycleKind;
  /**
   * Position on the happy-path funnel (0..5). Terminal-lost statuses share the
   * sentinel -1 (they leave the funnel rather than sit on it).
   */
  order: number;
  /** Plain-language description of what this stage means. */
  description: string;
}

/** Unknown / unset status fallback — never throws, never renders "undefined". */
const UNKNOWN_STAGE: LifecycleStage = {
  status: "unknown",
  label: "Unknown",
  kind: "pending",
  order: 0,
  description: "Status not recognised — treated as a new, un-actioned lead.",
};

const STAGES: Record<string, LifecycleStage> = {
  new: {
    status: "new",
    label: "New",
    kind: "pending",
    order: 0,
    description: "Sourced and in the directory — no email has been sent yet.",
  },
  contacted: {
    status: "contacted",
    label: "Contacted",
    kind: "active",
    order: 1,
    description: "A first-touch email has been sent.",
  },
  opened: {
    status: "opened",
    label: "Opened",
    kind: "active",
    order: 2,
    description: "The prospect opened at least one email.",
  },
  replied: {
    status: "replied",
    label: "Replied",
    kind: "active",
    order: 3,
    description: "The prospect replied — see the reply intent below.",
  },
  qualified: {
    status: "qualified",
    label: "Qualified",
    kind: "active",
    order: 4,
    description: "Marked qualified — a real opportunity to progress.",
  },
  converted: {
    status: "converted",
    label: "Converted",
    kind: "won",
    order: 5,
    description: "Won — the prospect converted.",
  },
  opted_out: {
    status: "opted_out",
    label: "Opted out",
    kind: "lost",
    order: -1,
    description: "Unsubscribed or asked to stop — suppressed, never contacted again.",
  },
  bounced: {
    status: "bounced",
    label: "Bounced",
    kind: "lost",
    order: -1,
    description: "Email bounced — address invalid; removed from sending.",
  },
};

/** The ordered happy-path steps, for a progress strip. Terminal-lost excluded. */
export const LIFECYCLE_STEPS: readonly LifecycleStage[] = [
  STAGES.new!,
  STAGES.contacted!,
  STAGES.opened!,
  STAGES.replied!,
  STAGES.qualified!,
  STAGES.converted!,
];

/** Resolve a stored status to its lifecycle stage. Tolerant of unknown input. */
export function lifecycleFor(status: string | null | undefined): LifecycleStage {
  if (!status) return UNKNOWN_STAGE;
  return STAGES[status] ?? { ...UNKNOWN_STAGE, status, label: status };
}

/** True when the lead has left the funnel for good (opted_out / bounced). */
export function isTerminalStatus(status: string | null | undefined): boolean {
  return lifecycleFor(status).kind === "lost";
}
