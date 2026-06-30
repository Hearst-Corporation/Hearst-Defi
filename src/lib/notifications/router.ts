/**
 * router.ts — Governance notification matrix router.
 *
 * Pure module: no I/O at call time, no prisma, no fetch.
 * Templates are loaded synchronously at module initialisation via Node's
 * `fs.readFileSync` (allowed at boot per CLAUDE.md).  The `render` path
 * resolves from a pre-built in-memory map — no filesystem access at runtime.
 *
 * Forbidden words enforced in templates:
 *   "guarantee", "promise", "certain", "will deliver", "risk-free"
 *   Exception: the phrase "not guaranteed" is explicitly permitted.
 */

import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { containsForbidden } from "@/lib/agents/forbidden-words";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotifEvent =
  | "proposal.created"
  | "proposal.signed"
  | "proposal.queued"
  | "timelock.unlocked"
  | "proposal.executed"
  | "proposal.cancelled";

export type NotifRole = "admin_signer" | "lp_holder" | "auditor";

export type NotifChannel = "email" | "telegram" | "in_app";

// ---------------------------------------------------------------------------
// Notification matrix — event × role → channel[]
// ---------------------------------------------------------------------------

export const NOTIFICATION_MATRIX: Record<
  NotifEvent,
  Record<NotifRole, NotifChannel[]>
> = {
  "proposal.created": {
    admin_signer: ["email", "telegram", "in_app"],
    lp_holder: ["in_app"],
    auditor: ["email", "in_app"],
  },
  "proposal.signed": {
    admin_signer: ["telegram", "in_app"],
    lp_holder: [],
    auditor: ["in_app"],
  },
  "proposal.queued": {
    admin_signer: ["email", "telegram", "in_app"],
    lp_holder: ["in_app"],
    auditor: ["email", "in_app"],
  },
  "timelock.unlocked": {
    admin_signer: ["email", "telegram", "in_app"],
    lp_holder: ["in_app"],
    auditor: ["email", "in_app"],
  },
  "proposal.executed": {
    admin_signer: ["email", "telegram", "in_app"],
    lp_holder: ["email", "in_app"],
    auditor: ["email", "telegram", "in_app"],
  },
  "proposal.cancelled": {
    admin_signer: ["email", "telegram", "in_app"],
    lp_holder: ["in_app"],
    auditor: ["email", "in_app"],
  },
};

// ---------------------------------------------------------------------------
// Template key helpers
// ---------------------------------------------------------------------------

/** Maps a NotifEvent to its template file stem (e.g. "proposal.created" → "proposal-created"). */
function eventToFileStem(event: NotifEvent): string {
  return event.replace(".", "-");
}

type TemplateKey = `${NotifEvent}::${NotifChannel}`;

function templateKey(event: NotifEvent, channel: NotifChannel): TemplateKey {
  return `${event}::${channel}`;
}

// ---------------------------------------------------------------------------
// Boot-time template loading
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = join(
  fileURLToPath(import.meta.url),
  "..",
  "templates",
);

/**
 * Parses a simple YAML-ish frontmatter block:
 *   ---
 *   subject: "…"
 *   ---
 *   body text
 *
 * Returns { subject, body }.
 */
function parseFrontmatter(raw: string): { subject: string; body: string } {
  const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = FM_RE.exec(raw.trim());
  if (!match) {
    return { subject: "", body: raw.trim() };
  }
  const [, frontmatter, body] = match;
  const subjectMatch = /^subject:\s*"(.*)"\s*$/m.exec(frontmatter ?? "");
  const subject = subjectMatch?.[1] ?? "";
  return { subject, body: (body ?? "").trim() };
}

/**
 * Asserts a template contains no forbidden words.
 *
 * Delegates to the canonical `containsForbidden` matcher from
 * `@/lib/agents/forbidden-words` so the boot-time template check is in lock-
 * step with the agent validator, the wizard hook, and the vault server-action
 * Zod refines — see `docs/audit/coherence-2026-05-26/06-forbidden-words.md`
 * (P0₁ + P2₂).
 *
 * Negated forms ("not guaranteed", "no promise of returns") are exempted via
 * the shared 3-word negation window — there is no longer a hand-rolled
 * `replace(/not guaranteed/, "")` pre-pass.
 */
function assertNoForbiddenWords(key: string, text: string): void {
  const result = containsForbidden(text);
  if (!result) return;
  const first = result.found[0]!;
  throw new Error(
    `Template "${key}" contains a forbidden word ("${first}"). Revise the template copy.`,
  );
}

/** Pre-built map: templateKey → { subject, body } loaded at module init. */
const TEMPLATE_MAP = new Map<TemplateKey, { subject: string; body: string }>();

const ALL_EVENTS: NotifEvent[] = [
  "proposal.created",
  "proposal.signed",
  "proposal.queued",
  "timelock.unlocked",
  "proposal.executed",
  "proposal.cancelled",
];

const ALL_CHANNELS: NotifChannel[] = ["email", "telegram", "in_app"];

// Load synchronously at boot.
for (const event of ALL_EVENTS) {
  for (const channel of ALL_CHANNELS) {
    const stem = eventToFileStem(event);
    const fileName = `${stem}.${channel}.md`;
    const filePath = join(TEMPLATES_DIR, fileName);
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      // Template file is optional — if not present, skip.
      continue;
    }
    const key = templateKey(event, channel);
    assertNoForbiddenWords(key, raw);
    TEMPLATE_MAP.set(key, parseFrontmatter(raw));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the channels that should receive a notification for a given
 * event × role combination.  Returns an empty array if none are configured.
 */
export function resolveChannels(
  event: NotifEvent,
  role: NotifRole,
): NotifChannel[] {
  return NOTIFICATION_MATRIX[event][role];
}

// ---------------------------------------------------------------------------
// Channel-aware value sanitization
// ---------------------------------------------------------------------------

/**
 * Escapes an interpolation value for the target channel to prevent
 * HTML / Markdown injection.
 *
 * - `email`    — HTML-escapes the five critical characters (`&<>"'`).
 * - `telegram` — MarkdownV2-escapes all reserved characters per the
 *                Telegram Bot API spec.
 * - `in_app`   — strips C0/DEL control characters then HTML-escapes.
 *
 * Pure function — no I/O, no side-effects.
 */
function escapeForChannel(value: unknown, channel: NotifChannel): string {
  const str = String(value ?? "");
  switch (channel) {
    case "email":
      // HTML escape (email templates rendered as HTML downstream)
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    case "telegram":
      // MarkdownV2 escape — https://core.telegram.org/bots/api#markdownv2-style
      return str.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
    case "in_app":
      // Strip C0/DEL control chars, then HTML-escape for safety
      return str
        .replace(/[\x00-\x1F\x7F]/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    default: {
      // Exhaustiveness check — TypeScript will error if NotifChannel grows.
      const _exhaust: never = channel;
      return String(_exhaust);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders the subject and body for a notification by interpolating `data`
 * into the pre-loaded markdown template for the given event × channel.
 *
 * Interpolation syntax: `{{key}}` is replaced by `data[key]`, sanitized
 * per-channel via `escapeForChannel` to prevent HTML/Markdown injection.
 * Unknown keys are left as-is (no runtime error).
 *
 * @throws If no template is registered for the event × channel combination.
 */
export function renderTemplate(
  event: NotifEvent,
  channel: NotifChannel,
  data: Record<string, string>,
): { subject: string; body: string } {
  const key = templateKey(event, channel);
  const tpl = TEMPLATE_MAP.get(key);
  if (!tpl) {
    throw new Error(
      `No template registered for "${key}". Ensure templates/${eventToFileStem(event)}.${channel}.md exists.`,
    );
  }

  function interpolate(str: string): string {
    return str.replace(
      /\{\{(\w+)\}\}/g,
      (_, k: string) =>
        k in data
          ? escapeForChannel(data[k], channel)
          : `{{${k}}}`,
    );
  }

  return {
    subject: interpolate(tpl.subject),
    body: interpolate(tpl.body),
  };
}
