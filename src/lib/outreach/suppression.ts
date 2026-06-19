import "server-only";

import { prisma } from "@/lib/db";

/**
 * Do-not-contact gate for the send paths.
 *
 * The suppression list (OutreachSuppression) is the single source of truth for
 * "never email this address". It is checked at SOURCING (skip creating known-bad
 * prospects) AND — critically — at SEND time here, because a prospect can opt
 * out AFTER an email has been drafted/approved. Without a send-time check, an
 * opt-out would not stop an in-flight campaign, which defeats the compliance
 * purpose of the unsubscribe link.
 *
 * An entry suppresses when it is permanent (`until` null) or still within its
 * window (`until` in the future). A by-domain entry suppresses every address on
 * that domain. Lowercase-normalised to match how addresses are stored.
 */

/** True when this email must NOT be sent to (permanent or unexpired entry). */
export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return true; // never send to an empty address

  const domain = normalized.includes("@")
    ? normalized.slice(normalized.indexOf("@") + 1)
    : null;

  const now = new Date();
  const hit = await prisma.outreachSuppression.findFirst({
    where: {
      OR: [{ email: normalized }, ...(domain ? [{ domain }] : [])],
      // Permanent (until null) OR still within the suppression window.
      AND: [{ OR: [{ until: null }, { until: { gt: now } }] }],
    },
    select: { id: true },
  });

  return hit !== null;
}
