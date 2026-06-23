import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Outreach status variants — shared badge mappings for prospects and campaigns.
 *
 * These are presentation constants (not business logic) used across the
 * outreach admin surfaces to ensure consistent badge coloring.
 */

/** Prospect lifecycle status → Badge variant. */
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
