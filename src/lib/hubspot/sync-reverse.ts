import "server-only";

import { prisma } from "@/lib/db";
import { searchRecentlyModifiedContacts } from "@/lib/hubspot/client";
import { hubspotPropsToQualification } from "@/lib/hubspot/reverse-map";

export interface ReverseSyncResult {
  scanned: number;
  updated: number;
  unmatched: number;
}

/**
 * Polls HubSpot for contacts modified since `sinceMs`, matches each by email
 * to a QualificationProfile, and writes back any changed hearst_* properties.
 *
 * This is the no-webhook reverse path (HubSpot → Hearst): it runs on a cron
 * and needs only the Private App PAT (no Public App / Operations Hub).
 *
 * Idempotent: writing the same values twice is a harmless no-op. Only the
 * hearst_* fields are touched — never identity columns.
 */
export async function reverseSyncFromHubSpot(
  sinceMs: number,
  limit = 100,
): Promise<ReverseSyncResult> {
  const contacts = await searchRecentlyModifiedContacts(sinceMs, limit);

  let updated = 0;
  let unmatched = 0;

  for (const contact of contacts) {
    const email = contact.properties.email;
    if (!email) {
      unmatched++;
      continue;
    }

    const data = hubspotPropsToQualification(contact.properties);
    if (Object.keys(data).length === 0) continue;

    const result = await prisma.qualificationProfile.updateMany({
      where: { email: email.trim().toLowerCase() },
      data: { ...data, updatedAt: new Date() },
    });

    if (result.count > 0) updated += result.count;
    else unmatched++;
  }

  return { scanned: contacts.length, updated, unmatched };
}
