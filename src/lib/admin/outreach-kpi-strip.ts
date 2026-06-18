import type { HeroKpi } from "@/lib/data/cockpit";
import type { OutreachStats, CampaignRow } from "@/lib/data/outreach";

/**
 * Derives 3–4 honest KPIs from data already loaded by the outreach page.
 * No DB queries — pure derivation from pre-fetched stats + campaigns list.
 *
 * Returns [] when prospects = 0 AND campaigns = 0 (caller suppresses the strip).
 *
 * Provenance: all figures come from operator-confirmed DB records → "manual".
 */
export function buildOutreachKpiStrip(
  stats: OutreachStats,
  campaigns: CampaignRow[],
): HeroKpi[] {
  const { totalProspects, prospectsByStatus, emails } = stats;

  // Suppress strip on a completely empty workspace
  if (totalProspects === 0 && campaigns.length === 0) return [];

  // Active = campaigns in review or actively sending (not draft, not closed)
  const activeCampaigns = campaigns.filter((c) =>
    ["review", "sending"].includes(c.status),
  ).length;

  // New/uncontacted prospects = actionable backlog
  const newProspects = prospectsByStatus["new"] ?? 0;

  const kpis: HeroKpi[] = [
    {
      label: "Prospects",
      value: String(totalProspects),
      sublabel: newProspects > 0 ? `${newProspects} uncontacted` : "in directory",
      provenance: "manual",
      accent: totalProspects > 0,
    },
    {
      label: "Campaigns",
      value: String(campaigns.length),
      sublabel:
        activeCampaigns > 0
          ? `${activeCampaigns} active`
          : "none active",
      provenance: "manual",
    },
  ];

  // Pending review = emails in draft status (real queue depth, not fabricated)
  const pendingReview = campaigns.reduce((sum, c) => sum + (c.total - c.sent), 0);
  if (pendingReview > 0) {
    kpis.push({
      label: "Pending review",
      value: String(pendingReview),
      sublabel: "emails not yet sent",
      provenance: "manual",
      alert: false,
    });
  }

  // Sent — only surface if something has actually been sent (never fabricate)
  if (emails.sent > 0) {
    kpis.push({
      label: "Sent",
      value: String(emails.sent),
      sublabel: "emails delivered",
      provenance: "manual",
    });
  }

  return kpis;
}
