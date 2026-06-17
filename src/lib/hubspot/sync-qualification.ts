import "server-only";

import type { QualificationProfile } from "@prisma/client";

import { prisma } from "@/lib/db";
import { upsertContactByEmail } from "@/lib/hubspot/client";
import { mapQualificationToHubSpot } from "@/lib/hubspot/map-qualification";

/**
 * Upserts a HubSpot contact from a QualificationProfile and records the sync
 * in HubSpotSync for idempotency. Best-effort — callers should catch errors.
 */
export async function upsertHubSpotContact(
  userId: string | null,
  profile: QualificationProfile,
): Promise<void> {
  if (!profile.email) return;

  // Idempotency: skip if we already synced this qualification row.
  const alreadySynced = userId
    ? await prisma.hubSpotSync.findFirst({
        where: { userId, kind: "contact_upsert", sourceId: profile.id },
        select: { id: true },
      })
    : null;
  if (alreadySynced) return;

  const props = mapQualificationToHubSpot(profile);
  const contactId = await upsertContactByEmail(profile.email, props);

  if (userId) {
    await prisma.hubSpotSync.create({
      data: {
        userId,
        kind: "contact_upsert",
        hubspotObjectId: contactId,
        sourceId: profile.id,
      },
    });
  }
}
