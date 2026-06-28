import type { BentoBadgeVariant as BadgeVariant } from "@/components/catalyst/bento-badge";

/**
 * Outreach status variants — shared badge mappings for prospects, tiers,
 * campaigns, and lifecycle states.
 *
 * These are presentation constants (not business logic) used across the
 * outreach admin surfaces to ensure consistent badge coloring.
 */

/** Prospect lifecycle status → Badge variant.
 *  Used across outreach pages (list view and detail view).
 */
export const PROSPECT_VARIANT: Record<
  string,
  BadgeVariant
> = {
  new: "default",
  contacted: "accent",
  opened: "accent",
  replied: "success",
  qualified: "success",
  converted: "success",
  opted_out: "warning",
  bounced: "danger",
};

/** Autonomy tier → Badge variant (A prime, B warm, C cold). */
export const TIER_VARIANT: Record<string, "default" | "success" | "warning" | "accent"> = {
  A: "success",
  B: "accent",
  C: "default",
};

/** Campaign status → Badge variant. */
export const CAMPAIGN_VARIANT: Record<
  string,
  Exclude<BadgeVariant, "danger">
> = {
  draft: "default",
  review: "warning",
  sending: "accent",
  sent: "success",
};
