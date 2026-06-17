#!/usr/bin/env node
/**
 * Idempotently provisions the `hearst_*` custom contact properties in HubSpot.
 *
 * Run once per HubSpot portal (and safe to re-run — existing properties are
 * skipped). Requires HUBSPOT_API_KEY with scope crm.schemas.contacts.write.
 *
 *   HUBSPOT_API_KEY=pat-… node scripts/hubspot-provision-properties.mjs
 *
 * These properties are written by the Typeform→HubSpot sync
 * (src/lib/hubspot/map-qualification.ts) and read back by the inbound webhook
 * (src/app/api/hubspot/webhook/route.ts). If they don't exist, the contact
 * upsert fails with PROPERTY_DOESNT_EXIST.
 */

const TOKEN = process.env.HUBSPOT_API_KEY;
if (!TOKEN) {
  console.error("HUBSPOT_API_KEY is not set");
  process.exit(1);
}

const BASE = "https://api.hubapi.com";
const GROUP = "contactinformation";

// Enumeration options mirror the QualificationProfile field values.
const ENUM = (label, opts) => ({
  label,
  type: "enumeration",
  fieldType: "select",
  options: opts.map((o) => ({ label: o, value: o })),
});

/** name → property definition (label/type) */
const PROPERTIES = {
  hearst_platform_type: ENUM("Hearst — Platform type", [
    "crypto",
    "exchange",
    "wealth",
    "custody",
  ]),
  hearst_aum: ENUM("Hearst — AUM", [
    "lt_10m",
    "10_50m",
    "50_250m",
    "250m_plus",
    "unsure",
  ]),
  hearst_funds_usage: ENUM("Hearst — Funds usage", ["idle", "mix", "earning"]),
  hearst_yield_status: ENUM("Hearst — Yield status", [
    "live",
    "in_progress",
    "not_yet",
  ]),
  hearst_yield_type: ENUM("Hearst — Yield type", [
    "low_risk",
    "balanced",
    "growth",
    "unsure",
  ]),
  hearst_vault_size: ENUM("Hearst — Vault size", [
    "100_500k",
    "500k_1m",
    "1_5m",
    "5m_plus",
    "unsure",
  ]),
  hearst_timeline: ENUM("Hearst — Timeline", [
    "asap",
    "1_3m",
    "3_6m",
    "exploring",
  ]),
  hearst_qualified_at: {
    label: "Hearst — Qualified at",
    type: "date",
    fieldType: "date",
  },
};

async function hs(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

let created = 0;
let skipped = 0;
let failed = 0;

for (const [name, def] of Object.entries(PROPERTIES)) {
  const res = await hs("POST", "/crm/v3/properties/contacts", {
    name,
    groupName: GROUP,
    ...def,
  });

  if (res.ok) {
    console.log(`✅ created  ${name}`);
    created++;
  } else if (res.body.includes("already exists") || res.body.includes("PROPERTY_ALREADY_EXISTS")) {
    console.log(`↺  exists   ${name}`);
    skipped++;
  } else {
    console.error(`❌ failed   ${name} → ${res.status}: ${res.body.slice(0, 200)}`);
    failed++;
  }
}

console.log(`\nDone — ${created} created, ${skipped} already existed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
