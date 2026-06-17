import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma, type QualificationProfile } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  calibratePersona,
  type QualificationAnswers,
} from "@/lib/agents/calibration";
import { assertNoForbiddenWords } from "@/lib/agents/validators";

export type { QualificationProfile };

// ---------------------------------------------------------------------------
// Typeform answer mapping
// ---------------------------------------------------------------------------
//
// The form (form.typeform.com/to/NXUw7yzJ) uses multiple_choice questions
// whose option LABELS are stable but not globally unique ("Not sure yet"
// appears in several questions). So we route each answer by its QUESTION TITLE
// first, then map the chosen label within that question's dictionary.

/** Normalise a label/title for tolerant matching (case, accents, spacing, $). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s ]+/g, " ")
    .trim();
}

function mapByContains(
  label: string,
  table: ReadonlyArray<[needle: string, value: string]>,
): string | null {
  const n = norm(label);
  for (const [needle, value] of table) {
    if (n.includes(norm(needle))) return value;
  }
  return null;
}

const PLATFORM_TABLE: ReadonlyArray<[string, string]> = [
  ["exchange", "exchange"],
  ["wealth", "wealth"],
  ["custody", "custody"],
  ["infrastructure", "custody"],
  ["crypto", "crypto"],
];

const FUNDS_TABLE: ReadonlyArray<[string, string]> = [
  ["unused", "idle"],
  ["sitting", "idle"],
  ["mix", "mix"],
  ["earning", "earning"],
];

const YIELD_STATUS_TABLE: ReadonlyArray<[string, string]> = [
  ["live", "live"],
  ["in progress", "in_progress"],
  ["not yet", "not_yet"],
];

const YIELD_TYPE_TABLE: ReadonlyArray<[string, string]> = [
  ["low-risk", "low_risk"],
  ["low risk", "low_risk"],
  ["balanced", "balanced"],
  ["growth", "growth"],
  ["not sure", "unsure"],
];

const TIMELINE_TABLE: ReadonlyArray<[string, string]> = [
  ["asap", "asap"],
  ["1 - 3", "1_3m"],
  ["1 – 3", "1_3m"],
  ["3 - 6", "3_6m"],
  ["3 – 6", "3_6m"],
  ["exploring", "exploring"],
];

/** AUM needs special handling: "$50M – $250M" contains "50m" AND "250m". */
function mapAum(label: string): string | null {
  const n = norm(label);
  if (n.includes("not sure")) return "unsure";
  if (n.includes("<$10m") || n.includes("<10m") || n.includes("< $10m"))
    return "lt_10m";
  if (n.includes("250m") && n.includes("50m")) return "50_250m"; // "$50M – $250M"
  if (n.includes("10m") && n.includes("50m")) return "10_50m"; // "$10M – $50M"
  if (n.includes("250m")) return "250m_plus";
  if (n.includes("50m")) return "50_250m";
  if (n.includes("10m")) return "10_50m";
  return null;
}

/** Vault size: "$1M – $5M" contains "1m" and "5m" — order the checks. */
function mapVaultSize(label: string): string | null {
  const n = norm(label);
  if (n.includes("5m+")) return "5m_plus";
  if (n.includes("1m") && n.includes("5m")) return "1_5m";
  if (n.includes("500k") && n.includes("1m")) return "500k_1m";
  if (n.includes("100k")) return "100_500k";
  if (n.includes("not sure")) return "unsure";
  return null;
}

interface TitleRoute {
  match: string; // normalised substring of the question title
  field: keyof QualificationAnswers | "firstName" | "lastName";
  map?: (label: string) => string | null;
}

const TITLE_ROUTES: TitleRoute[] = [
  { match: "describes your platform", field: "platformType", map: (l) => mapByContains(l, PLATFORM_TABLE) },
  { match: "assets under management", field: "aum", map: mapAum },
  { match: "sitting unused", field: "fundsUsage", map: (l) => mapByContains(l, FUNDS_TABLE) },
  { match: "yield or reward products", field: "yieldStatus", map: (l) => mapByContains(l, YIELD_STATUS_TABLE) },
  { match: "type of yield product", field: "yieldType", map: (l) => mapByContains(l, YIELD_TYPE_TABLE) },
  { match: "vault size", field: "vaultSize", map: mapVaultSize },
  { match: "launch timeline", field: "timeline", map: (l) => mapByContains(l, TIMELINE_TABLE) },
];

// ---------------------------------------------------------------------------
// Typeform webhook payload (minimal shape we read)
// ---------------------------------------------------------------------------

interface TypeformField {
  id?: string;
  ref?: string;
  title?: string;
  type?: string;
}

interface TypeformAnswer {
  field?: { id?: string; ref?: string; type?: string };
  type?: string;
  choice?: { label?: string };
  choices?: { labels?: string[] };
  text?: string;
  email?: string;
  phone_number?: string;
  url?: string;
}

export interface TypeformWebhookPayload {
  form_response?: {
    definition?: { fields?: TypeformField[] };
    answers?: TypeformAnswer[];
  };
}

export interface ParsedQualification {
  answers: QualificationAnswers;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  website: string | null;
}

/**
 * Parses a Typeform webhook payload into our structured shape. Joins each
 * answer to its question title via the definition, then routes through the
 * per-question maps. Unknown/unmatched answers are ignored (never throw).
 */
export function parseTypeformPayload(
  payload: TypeformWebhookPayload,
): ParsedQualification {
  const fields = payload.form_response?.definition?.fields ?? [];
  const answers = payload.form_response?.answers ?? [];

  const titleByRef = new Map<string, string>();
  for (const f of fields) {
    const ref = f.ref ?? f.id;
    if (ref && f.title) titleByRef.set(ref, f.title);
  }

  const out: ParsedQualification = {
    answers: {},
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    website: null,
  };

  for (const a of answers) {
    const ref = a.field?.ref ?? a.field?.id ?? "";
    const title = norm(titleByRef.get(ref) ?? "");

    // Contact answers (by answer type).
    if (a.type === "email" || a.email) {
      out.email = (a.email ?? a.text ?? null)?.trim().toLowerCase() ?? null;
      continue;
    }
    if (a.type === "phone_number" || a.phone_number) {
      out.phone = a.phone_number ?? a.text ?? null;
      continue;
    }
    if (a.type === "url" || a.url) {
      out.website = a.url ?? a.text ?? null;
      continue;
    }

    // Choice answers → route by question title.
    const label = a.choice?.label ?? a.choices?.labels?.[0] ?? a.text ?? null;
    if (label === null) continue;

    const route = TITLE_ROUTES.find((r) => title.includes(r.match));
    if (route) {
      const value = route.map ? route.map(label) : label;
      if (value !== null) {
        (out.answers as Record<string, string>)[route.field] = value;
      }
      continue;
    }

    // Name fields (short_text whose title carries "first"/"last name").
    if (title.includes("first name")) out.firstName = a.text ?? label;
    else if (title.includes("last name")) out.lastName = a.text ?? label;
    else if (title.includes("language") || title.includes("langue")) {
      out.answers.language = norm(label).startsWith("en") ? "en" : "fr";
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Persistence + calibration
// ---------------------------------------------------------------------------

export interface UpsertQualificationInput
  extends QualificationAnswers,
    Partial<Pick<ParsedQualification, "firstName" | "lastName" | "phone" | "website">> {
  userId?: string | null;
  email?: string | null;
  source?: "typeform" | "manual" | "self";
  rawPayload?: unknown;
}

/**
 * Creates or updates a QualificationProfile. Matched by userId when present,
 * else by email. Returns the row.
 */
export async function upsertQualification(
  input: UpsertQualificationInput,
): Promise<QualificationProfile> {
  const normalizedEmail =
    input.email !== undefined && input.email !== null
      ? input.email.trim().toLowerCase()
      : input.email ?? null;

  const data = {
    userId: input.userId ?? null,
    email: normalizedEmail,
    source: input.source ?? "typeform",
    platformType: input.platformType ?? null,
    aum: input.aum ?? null,
    fundsUsage: input.fundsUsage ?? null,
    yieldStatus: input.yieldStatus ?? null,
    yieldType: input.yieldType ?? null,
    vaultSize: input.vaultSize ?? null,
    timeline: input.timeline ?? null,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    // Prisma Json: omit when not provided; store DbNull when explicitly null;
    // otherwise the object. Raw `null` is not a valid Json input.
    ...(input.rawPayload === undefined
      ? {}
      : {
          rawPayload:
            input.rawPayload === null
              ? Prisma.DbNull
              : (input.rawPayload as Prisma.InputJsonValue),
        }),
  };

  // Prefer userId as the unique key; fall back to email match.
  if (input.userId) {
    return prisma.qualificationProfile.upsert({
      where: { userId: input.userId },
      create: data,
      update: data,
    });
  }

  if (input.email) {
    const existing = await prisma.qualificationProfile.findFirst({
      where: { email: normalizedEmail, userId: null },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      return prisma.qualificationProfile.update({
        where: { id: existing.id },
        data,
      });
    }
  }

  return prisma.qualificationProfile.create({ data });
}

/**
 * Loads a user's qualification answers and writes the calibrated persona into
 * their cockpit-chat UserAgentProfile (override fields). Returns null when the
 * user has no qualification profile yet.
 *
 * The composed customInstructions are forbidden-words checked before write so
 * an invalid persona never reaches the prompt.
 */
export async function applyCalibrationToUser(
  userId: string,
  agentName = "cockpit-chat",
): Promise<{ tone: string; language: string; verbosity: string } | null> {
  const profile = await prisma.qualificationProfile.findUnique({
    where: { userId },
  });
  if (!profile) return null;

  const persona = calibratePersona(toAnswers(profile));

  // Composed instructions use exempt forms ("non garanti"); assert anyway so a
  // future edit that introduces a forbidden claim fails fast.
  assertNoForbiddenWords(persona.customInstructions);

  await prisma.userAgentProfile.upsert({
    where: { userId_agentName: { userId, agentName } },
    create: {
      userId,
      agentName,
      tone: persona.tone,
      language: persona.language,
      verbosity: persona.verbosity,
      customInstructions: persona.customInstructions,
    },
    update: {
      tone: persona.tone,
      language: persona.language,
      verbosity: persona.verbosity,
      customInstructions: persona.customInstructions,
    },
  });

  return {
    tone: persona.tone,
    language: persona.language,
    verbosity: persona.verbosity,
  };
}

/** Narrow a QualificationProfile row into the pure calibration input. */
export function toAnswers(p: QualificationProfile): QualificationAnswers {
  return {
    platformType: p.platformType as QualificationAnswers["platformType"],
    aum: p.aum as QualificationAnswers["aum"],
    fundsUsage: p.fundsUsage as QualificationAnswers["fundsUsage"],
    yieldStatus: p.yieldStatus as QualificationAnswers["yieldStatus"],
    yieldType: p.yieldType as QualificationAnswers["yieldType"],
    vaultSize: p.vaultSize as QualificationAnswers["vaultSize"],
    timeline: p.timeline as QualificationAnswers["timeline"],
  };
}

/**
 * Links an orphan QualificationProfile (submitted before account creation) to a
 * User by email. Returns true when a row was linked.
 */
export async function linkQualificationByEmail(
  userId: string,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const already = await prisma.qualificationProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (already) return false;

  const orphan = await prisma.qualificationProfile.findFirst({
    where: { email: normalized, userId: null },
    orderBy: { updatedAt: "desc" },
  });
  if (!orphan) return false;

  await prisma.qualificationProfile.update({
    where: { id: orphan.id },
    data: { userId },
  });
  return true;
}

// ---------------------------------------------------------------------------
// Webhook auto-provisioning
// ---------------------------------------------------------------------------

/**
 * Auto-creates a User + Investor from a Typeform webhook submission when the
 * email is not yet registered. No requireAdmin() — this is a trusted internal
 * call from the webhook handler (HMAC-validated). Returns the created IDs, or
 * null if the email already has an account.
 */
export async function createInvestorFromWebhook(
  email: string,
): Promise<{ userId: string; investorId: string } | null> {
  const normalized = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existing) return null;

  // Unusable password hash — the user activates via the welcome email link.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));

  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      role: "investor",
      investor: {
        create: {
          email: normalized,
          kycStatus: "pending",
        },
      },
    },
    include: { investor: true },
  });

  if (!user.investor) return null;
  return { userId: user.id, investorId: user.investor.id };
}
