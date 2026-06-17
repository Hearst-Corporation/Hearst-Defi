/**
 * Maps HubSpot `hearst_*` contact properties back to QualificationProfile
 * fields. Pure — no I/O — so it's shared by the inbound webhook AND the
 * polling reverse-sync cron, and unit-testable.
 *
 * Only hearst_* custom properties are mapped (never standard fields like
 * email/firstname) to avoid feedback loops with the outbound sync.
 */

/** HubSpot property name → QualificationProfile column. */
export const HUBSPOT_TO_QUALIFICATION: Record<string, string> = {
  hearst_platform_type: "platformType",
  hearst_aum: "aum",
  hearst_funds_usage: "fundsUsage",
  hearst_yield_status: "yieldStatus",
  hearst_yield_type: "yieldType",
  hearst_vault_size: "vaultSize",
  hearst_timeline: "timeline",
};

/**
 * Projects a HubSpot contact's properties onto the QualificationProfile fields
 * we track. Returns only the keys present in the source (so a partial update
 * never wipes untouched columns). Empty-string values become null.
 */
export function hubspotPropsToQualification(
  props: Record<string, string | null | undefined>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [hsKey, field] of Object.entries(HUBSPOT_TO_QUALIFICATION)) {
    if (hsKey in props) {
      const value = props[hsKey];
      out[field] = value && value.length > 0 ? value : null;
    }
  }
  return out;
}
