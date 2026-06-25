import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { buildEmailWrapper } from "@/lib/email/html-shell";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

/**
 * Welcome email sent to a newly-provisioned investor (Typeform auto-create or
 * admin provisioning). Reuses the PasswordResetToken table and the
 * /reset-password page — the user clicks the link to set their password and
 * is then logged in for the first time.
 *
 * TTL is 7 days (vs 1 hour for a standard reset) — the new user may not check
 * email immediately.
 *
 * Best-effort: errors are swallowed so account creation never fails because
 * Resend is down.
 */

const WELCOME_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function sendEmail(
  to: string,
  firstName: string | null,
  resetUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const ttlDays = WELCOME_TOKEN_TTL_MS / (24 * 3_600_000);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hearst Connect <noreply@hearst.app>",
      to: [to],
      subject: "Bienvenue sur Hearst Connect — Activez votre accès",
      html: `
        ${buildEmailWrapper(`
          <h2 style="color:${CONNECT_ACCENT_HEX};font-size:20px;margin:0 0 16px;">Bienvenue sur Hearst Connect</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
            ${greeting}<br/>
            Votre accès à la plateforme Hearst Connect a été créé. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace.
          </p>
          <p style="margin:0 0 24px;font-size:12px;color:#6b7280;">
            Ce lien est valable ${ttlDays} jours et ne peut être utilisé qu'une seule fois.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:${CONNECT_ACCENT_HEX};color:#0a0a0a;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">
            Activer mon accès
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        `)}
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}

/**
 * Mints a fresh 7-day activation (PasswordResetToken) and returns the raw token
 * plus the full /reset-password?token=… activation URL. Sends NO email — the
 * caller decides whether to dispatch it (welcome flow) or surface the link in
 * the admin UI for manual delivery (resend-activation dead-end recovery).
 *
 * Each call creates a NEW token (the old one stays valid until its own expiry);
 * the most recent link is the one to share.
 */
export async function mintActivationToken(opts: {
  userId: string;
  appUrl: string;
}): Promise<{ rawToken: string; activationUrl: string }> {
  const { userId, appUrl } = opts;

  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + WELCOME_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken: raw, activationUrl: `${appUrl}/reset-password?token=${raw}` };
}

/**
 * Send a welcome / account-activation email to a newly created investor.
 * Generates a 7-day PasswordResetToken and links to /reset-password?token=…
 *
 * @param userId - The User.id of the newly created account
 * @param email  - Email address to send to
 * @param firstName - Optional first name for personalization
 * @param appUrl - e.g. "https://connect.hearst.app" (NEXT_PUBLIC_APP_URL)
 */
export async function sendWelcomeEmail(opts: {
  userId: string;
  email: string;
  firstName?: string | null;
  appUrl: string;
}): Promise<void> {
  const { userId, email, firstName, appUrl } = opts;

  const { activationUrl } = await mintActivationToken({ userId, appUrl });

  await sendEmail(email, firstName ?? null, activationUrl).catch((err) => {
    console.error("[welcome-email] Resend failed — token still valid in DB, use admin generateActivationLink to recover", { userId, email, err });
  });
}
