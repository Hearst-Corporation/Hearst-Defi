import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  upsertContactByEmail,
  createNote,
} from "@/lib/hubspot/client";

/**
 * Sync outreach prospects + email activity to HubSpot.
 *
 * All functions are BEST-EFFORT: they swallow errors and never throw to the
 * caller. When HUBSPOT_API_KEY is absent they no-op silently (return null /
 * void) so outreach flows keep working without HubSpot configured.
 */

function hubspotConfigured(): boolean {
  return Boolean(env.HUBSPOT_API_KEY);
}

type ProspectInput = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
};

/**
 * Upserts a HubSpot contact for an outreach prospect.
 *
 * Maps to HubSpot standard contact props (firstname, lastname, company,
 * jobtitle) + lifecyclestage "lead". Records a HubSpotSync row
 * (kind "prospect_upsert", sourceId = prospect.id) for idempotency and writes
 * the resolved contact id back onto OutreachProspect.hubspotContactId.
 *
 * Returns the HubSpot contact id, or null on any failure / missing API key.
 */
export async function upsertProspectContact(
  prospect: ProspectInput,
): Promise<string | null> {
  if (!hubspotConfigured()) return null;

  try {
    const props: Record<string, string> = { lifecyclestage: "lead" };
    if (prospect.firstName) props.firstname = prospect.firstName;
    if (prospect.lastName) props.lastname = prospect.lastName;
    if (prospect.company) props.company = prospect.company;
    if (prospect.title) props.jobtitle = prospect.title;

    const contactId = await upsertContactByEmail(prospect.email, props);

    await prisma.hubSpotSync.create({
      data: {
        userId: prospect.id, // informational, no FK — prospect id for outreach syncs
        kind: "prospect_upsert",
        hubspotObjectId: contactId,
        sourceId: prospect.id,
      },
    });

    await prisma.outreachProspect.update({
      where: { id: prospect.id },
      data: { hubspotContactId: contactId },
    });

    return contactId;
  } catch {
    return null;
  }
}

type EmailActivity = {
  prospectId: string;
  type: "sent" | "opened" | "clicked" | "bounced";
  subject?: string;
};

/**
 * Logs an outreach email activity as a HubSpot Note on the prospect's contact.
 *
 * Resolves the prospect's hubspotContactId from the DB; if missing, upserts the
 * contact first. Best-effort — swallows all errors and no-ops without an API key.
 */
export async function logEmailActivity(opts: EmailActivity): Promise<void> {
  if (!hubspotConfigured()) return;

  try {
    const prospect = await prisma.outreachProspect.findUnique({
      where: { id: opts.prospectId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        title: true,
        hubspotContactId: true,
      },
    });
    if (!prospect) return;

    const contactId =
      prospect.hubspotContactId ?? (await upsertProspectContact(prospect));
    if (!contactId) return;

    await createNote(
      contactId,
      `[outreach] ${opts.type}: ${opts.subject ?? ""}`,
    );
  } catch {
    // best-effort: never throw to caller
  }
}
