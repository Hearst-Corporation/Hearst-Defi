import type { HeroKpi } from "@/lib/data/cockpit";
import type { OutreachStats } from "@/lib/data/outreach";

/**
 * Derives honest KPIs for the outreach console header strip from the global
 * outreach stats already computed by the admin/outreach page.
 *
 * Provenance:
 * - Prospect / email counts → "manual" (operator-managed CRM + Resend funnel,
 *   not on-chain, not oracle).
 *
 * Honesty: rates are derived (open/click over delivered, bounce over sent) and
 * surface as plain percentages — no rate cell is shown until at least one email
 * has actually been sent, so a 0% never implies a measured-and-failed signal.
 */
export function buildOutreachKpiStrip(stats: OutreachStats): HeroKpi[] {
  const { totalProspects, emails, rates } = stats;

  const kpis: HeroKpi[] = [
    {
      label: "Total prospects",
      value: String(totalProspects),
      sublabel: "sourced contacts",
      provenance: "manual",
    },
    {
      label: "Emails sent",
      value: String(emails.sent),
      sublabel: `${emails.delivered} delivered`,
      provenance: "manual",
      accent: emails.sent > 0,
    },
  ];

  // Rates only mean something once mail has left the building — until then the
  // denominator is zero and a "0%" would be misleading, so omit them.
  if (emails.sent > 0) {
    kpis.push({
      label: "Open rate",
      value: `${rates.openRate}%`,
      sublabel: `of ${emails.delivered} delivered`,
      provenance: "manual",
    });
    kpis.push({
      label: "Bounce rate",
      value: `${rates.bounceRate}%`,
      sublabel: `${emails.bounced} of ${emails.sent} sent`,
      provenance: "manual",
      alert: emails.bounced > 0,
    });
  }

  return kpis;
}
