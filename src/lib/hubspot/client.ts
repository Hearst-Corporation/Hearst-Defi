import "server-only";

/**
 * HubSpot REST v3 client — fetch-only, no SDK dependency.
 *
 * Env: HUBSPOT_API_KEY — Bearer token from a Private App with scopes:
 *   crm.objects.contacts.write, crm.objects.contacts.read,
 *   crm.objects.notes.write
 *
 * Fail-closed: every function throws when the API key is absent so callers
 * (all best-effort) can catch and swallow gracefully.
 */

const BASE = "https://api.hubapi.com";

function apiKey(): string {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error("HUBSPOT_API_KEY is not set");
  return key;
}

async function hs<T>(
  method: "GET" | "POST" | "PATCH" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`HubSpot ${method} ${path} → ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

interface SearchResult {
  total: number;
  results: HubSpotContact[];
}

/** Find a contact by email. Returns null when not found (404 is not an error). */
export async function getContactByEmail(
  email: string,
): Promise<HubSpotContact | null> {
  const result = await hs<SearchResult>(
    "POST",
    "/crm/v3/objects/contacts/search",
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email },
          ],
        },
      ],
      properties: ["email", "firstname", "lastname"],
      limit: 1,
    },
  );
  return result.results[0] ?? null;
}

/**
 * Lists contacts modified at-or-after `sinceMs` (epoch ms), newest first.
 * Used by the reverse-sync cron to pull HubSpot → Hearst changes without a
 * webhook. Returns the requested `properties` (always includes email + the
 * hearst_* fields the sync cares about).
 */
export async function searchRecentlyModifiedContacts(
  sinceMs: number,
  limit = 100,
): Promise<HubSpotContact[]> {
  const result = await hs<SearchResult>(
    "POST",
    "/crm/v3/objects/contacts/search",
    {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: String(sinceMs),
            },
          ],
        },
      ],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
      properties: [
        "email",
        "lastmodifieddate",
        "hearst_platform_type",
        "hearst_aum",
        "hearst_funds_usage",
        "hearst_yield_status",
        "hearst_yield_type",
        "hearst_vault_size",
        "hearst_timeline",
      ],
      limit,
    },
  );
  return result.results;
}

/**
 * Create-or-update a contact by email. Returns the HubSpot contact id.
 * Uses the v3 "upsert" endpoint (idempotent on email).
 */
export async function upsertContact(
  email: string,
  properties: Record<string, string>,
): Promise<string> {
  const result = await hs<HubSpotContact>(
    "POST",
    "/crm/v3/objects/contacts",
    { properties: { email, ...properties } },
  );
  return result.id;
}

/**
 * Update properties on an existing contact by HubSpot id.
 */
export async function updateContact(
  contactId: string,
  properties: Record<string, string>,
): Promise<void> {
  await hs<unknown>("PATCH", `/crm/v3/objects/contacts/${contactId}`, {
    properties,
  });
}

/**
 * Upsert: search by email first, update if found, create if not.
 * Returns the HubSpot contact id.
 */
export async function upsertContactByEmail(
  email: string,
  properties: Record<string, string>,
): Promise<string> {
  const existing = await getContactByEmail(email);
  if (existing) {
    await updateContact(existing.id, properties);
    return existing.id;
  }
  return upsertContact(email, properties);
}

// ---------------------------------------------------------------------------
// Notes (Engagements v3 → CRM Associations)
// ---------------------------------------------------------------------------

/**
 * Create a Note engagement on a contact.
 * The note body is plain text (HubSpot renders line-breaks).
 * Returns the note id.
 */
export async function createNote(
  contactId: string,
  body: string,
): Promise<string> {
  interface NoteResult {
    id: string;
  }

  // 1. Create the note object
  const note = await hs<NoteResult>("POST", "/crm/v3/objects/notes", {
    properties: {
      hs_note_body: body,
      hs_timestamp: new Date().toISOString(),
    },
  });

  // 2. Associate note → contact via the v4 default-association endpoint.
  // (The legacy v3 `/associations/contacts/{id}/note_to_contact` POST returns
  //  405; v4 PUT with the implicit default association type is the current API.)
  await hs<unknown>(
    "PUT",
    `/crm/v4/objects/notes/${note.id}/associations/default/contacts/${contactId}`,
  );

  return note.id;
}
