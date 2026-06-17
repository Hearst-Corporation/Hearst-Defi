import "server-only";

import type { QualificationProfile } from "@prisma/client";

/**
 * Maps a QualificationProfile row to HubSpot contact properties.
 *
 * Standard HubSpot properties: email, firstname, lastname, phone, website.
 * Custom properties (must be created once in HubSpot Settings → Properties):
 *   hearst_platform_type, hearst_aum, hearst_funds_usage, hearst_yield_status,
 *   hearst_yield_type, hearst_vault_size, hearst_timeline, hearst_qualified_at
 *
 * All values are strings (HubSpot properties are strings over the API).
 * Null/undefined fields are omitted so we never overwrite existing values
 * with empty strings.
 */
export function mapQualificationToHubSpot(
  profile: Pick<
    QualificationProfile,
    | "email"
    | "firstName"
    | "lastName"
    | "phone"
    | "website"
    | "platformType"
    | "aum"
    | "fundsUsage"
    | "yieldStatus"
    | "yieldType"
    | "vaultSize"
    | "timeline"
    | "submittedAt"
  >,
): Record<string, string> {
  const props: Record<string, string> = {};

  const set = (key: string, value: string | null | undefined) => {
    if (value) props[key] = value;
  };

  set("firstname", profile.firstName);
  set("lastname", profile.lastName);
  set("phone", profile.phone);
  set("website", profile.website);
  set("hearst_platform_type", profile.platformType);
  set("hearst_aum", profile.aum);
  set("hearst_funds_usage", profile.fundsUsage);
  set("hearst_yield_status", profile.yieldStatus);
  set("hearst_yield_type", profile.yieldType);
  set("hearst_vault_size", profile.vaultSize);
  set("hearst_timeline", profile.timeline);
  if (profile.submittedAt) {
    // HubSpot `date` properties expect a midnight-UTC date (YYYY-MM-DD), not a
    // full ISO datetime — sending the time component is rejected.
    props["hearst_qualified_at"] = profile.submittedAt
      .toISOString()
      .slice(0, 10);
  }

  return props;
}
