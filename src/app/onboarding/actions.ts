"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireInvestor } from "@/lib/auth/require-investor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when err is a Prisma unique-constraint violation (P2002). */
function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

// =============================================================================
// claimKycInquiry — P0-4 defence: server-authoritative inquiry→user binding
// =============================================================================

/**
 * claimKycInquiry
 *
 * Called by the onboarding UI (persona-embed) BEFORE the Persona SDK starts
 * an inquiry. It binds the inquiry ID to the AUTHENTICATED session user on the
 * server, so the webhook can resolve the userId from THIS table instead of the
 * client-supplied reference-id in the Persona payload.
 *
 * Security (P0-4): without this binding an attacker could launch a Persona
 * inquiry with the victim's userId as the reference-id and trigger approval
 * of the victim's account. The webhook now ONLY approves accounts whose
 * inquiryId was first claimed through a valid server session.
 *
 * Idempotent for the same (inquiryId, userId) pair (safe to retry).
 * Throws if the inquiryId is already claimed by a DIFFERENT userId (anti-theft).
 */
export async function claimKycInquiry(
  inquiryId: string,
): Promise<{ ok: boolean }> {
  if (!inquiryId || inquiryId.trim() === "") {
    throw new Error("claimKycInquiry: inquiryId must be a non-empty string");
  }

  const session = await requireInvestor("/onboarding/identity");
  const userId = session.userId;

  const existing = await prisma.kycInquiry.findUnique({
    where: { inquiryId },
  });

  if (existing) {
    if (existing.userId === userId) {
      // Same user re-claims — idempotent, ok.
      return { ok: true };
    }
    // Different user already owns this inquiryId — potential spoofing attempt.
    throw new Error("Inquiry already claimed by another account");
  }

  // E1: concurrent calls for the same inquiryId could both pass the findUnique
  // above (null) and then race to create — catch P2002 and verify ownership.
  try {
    await prisma.kycInquiry.create({
      data: { inquiryId, userId },
    });
  } catch (err) {
    if (isP2002(err)) {
      const after = await prisma.kycInquiry.findUnique({ where: { inquiryId } });
      if (after && after.userId !== userId) {
        throw new Error("Inquiry already claimed by another account");
      }
      // else: we lost the race to our own concurrent claim — idempotent success.
    } else {
      throw err;
    }
  }

  // B1: the webhook may have arrived before this claim (Persona races ahead).
  // If a terminal KYC event already landed, replay the approval now that the
  // authoritative link exists — otherwise the investor would stay pending forever.
  const terminal = await prisma.kycEvent.findFirst({
    where: { inquiryId, status: { in: ["completed", "approved"] } },
    orderBy: { receivedAt: "desc" },
  });
  if (terminal) {
    await markKycComplete(inquiryId);
  }

  return { ok: true };
}

// =============================================================================
// markKycComplete — C1 Persona KYC
// =============================================================================

/**
 * markKycComplete
 *
 * Server Action called by the Persona webhook when an inquiry reaches a
 * terminal "completed" or "approved" status.
 *
 * Resolves the userId AUTHORITATIVELY from KycInquiry (created by
 * claimKycInquiry() before the webhook arrives — P0-4 defence).
 * Falls back to KycEvent.findFirst for legacy inquiries started before
 * the KycInquiry table existed (pre-migration safety net).
 *
 * Idempotent: calling multiple times for the same inquiryId is safe.
 */
export async function markKycComplete(inquiryId: string): Promise<void> {
  if (!inquiryId || inquiryId.trim() === "") {
    throw new Error("markKycComplete: inquiryId must be a non-empty string");
  }

  // --- Authoritative resolution via KycInquiry (P0-4) ---
  const claim = await prisma.kycInquiry.findUnique({ where: { inquiryId } });

  let userId: string | undefined;

  if (claim) {
    userId = claim.userId;
  } else {
    // Legacy fallback: resolve from KycEvent for inquiries that pre-date the
    // KycInquiry table. Log a warning so ops can track the tail.
    console.warn(
      `[markKycComplete] no KycInquiry claim, falling back to KycEvent (legacy) for inquiryId=${inquiryId}`,
    );
    const event = await prisma.kycEvent.findFirst({
      where: { inquiryId },
      orderBy: { receivedAt: "desc" },
    });
    userId = event?.userId;
  }

  if (!userId || userId === "unknown" || userId === "unclaimed") {
    console.warn(
      `[markKycComplete] inquiryId=${inquiryId} has no resolvable userId — skipping Investor update`,
    );
    return;
  }

  // P0-5: only pending→approved. A rejected investor is terminal and must
  // never be silently re-approved by a replayed/late webhook.
  await prisma.investor.updateMany({
    where: {
      user: { id: userId },
      kycStatus: "pending",
    },
    data: { kycStatus: "approved" },
  });
}

// =============================================================================
// createSubscriptionEnvelope — C2 DocuSign
// =============================================================================

/**
 * Environment variable accessors.
 * All three must be set; we validate lazily (at call time) so the module can be
 * imported without crashing at boot when the vars are absent in test mocks.
 */
function getDocusignConfig(): {
  baseUrl: string;
  apiKey: string;
  accountId: string;
} {
  const baseUrl = process.env.DOCUSIGN_BASE_URL;
  const apiKey = process.env.DOCUSIGN_API_KEY;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

  if (!baseUrl || !apiKey || !accountId) {
    throw new Error(
      "Missing DocuSign configuration. Set DOCUSIGN_BASE_URL, DOCUSIGN_API_KEY, and DOCUSIGN_ACCOUNT_ID.",
    );
  }

  return { baseUrl, apiKey, accountId };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CreateEnvelopeInputSchema = z.object({
  userId: z.string().min(1).max(200),
  vaultId: z.string().min(1).max(200),
  amount: z.number().positive(),
  /** Real investor email — used for DocuSign recipient, never a placeholder. */
  email: z.string().email().max(320),
});

// DocuSign REST API — minimal subset of the createEnvelope response we use.
const DocusignCreateEnvelopeResponseSchema = z.object({
  envelopeId: z.string().min(1),
  status: z.string(),
});

// DocuSign REST API — createRecipientView response.
const DocusignRecipientViewSchema = z.object({
  url: z.string().url(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionEnvelopeResult {
  envelopeId: string;
  signingUrl: string;
}

// ---------------------------------------------------------------------------
// DocuSign helpers (pure functions — easier to test)
// ---------------------------------------------------------------------------

/**
 * POST /v2.1/accounts/{accountId}/envelopes
 * Creates an envelope for the subscription agreement.
 *
 * We use a "template" envelope body — in a real integration the templateId
 * would be an env var and the pre-populated tab values would carry investor
 * details. For the MVP we embed a minimal inline document so the call
 * works against a sandbox without a template pre-created.
 */
export async function docusignCreateEnvelope(
  baseUrl: string,
  apiKey: string,
  accountId: string,
  opts: { userId: string; email: string; vaultId: string; amount: number },
): Promise<{ envelopeId: string; status: string }> {
  const body = {
    emailSubject: "Hearst Connect — Subscription Agreement",
    status: "sent",
    documents: [
      {
        documentBase64: Buffer.from(
          `Hearst Connect Subscription Agreement\n\nInvestor: ${opts.userId}\nVault: ${opts.vaultId}\nAmount: ${opts.amount} USDC\n\nNot guaranteed. See full terms.`,
        ).toString("base64"),
        name: "Subscription Agreement",
        fileExtension: "txt",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: opts.email,
          name: opts.userId,
          recipientId: "1",
          routingOrder: "1",
          tabs: {
            signHereTabs: [
              {
                documentId: "1",
                pageNumber: "1",
                recipientId: "1",
                xPosition: "100",
                yPosition: "100",
              },
            ],
          },
        },
      ],
    },
  };

  const response = await fetch(
    `${baseUrl}/v2.1/accounts/${accountId}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `DocuSign createEnvelope failed: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const json: unknown = await response.json();
  const parsed = DocusignCreateEnvelopeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `DocuSign createEnvelope unexpected response shape: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}

/**
 * POST /v2.1/accounts/{accountId}/envelopes/{envelopeId}/views/recipient
 * Creates a one-time embedded signing URL (expires in ~5 minutes).
 */
export async function docusignCreateRecipientView(
  baseUrl: string,
  apiKey: string,
  accountId: string,
  envelopeId: string,
  opts: { userId: string; email: string; returnUrl: string },
): Promise<string> {
  const body = {
    authenticationMethod: "none",
    clientUserId: opts.userId,
    email: opts.email,
    recipientId: "1",
    returnUrl: opts.returnUrl,
    userName: opts.userId,
  };

  const response = await fetch(
    `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `DocuSign createRecipientView failed: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const json: unknown = await response.json();
  const parsed = DocusignRecipientViewSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `DocuSign createRecipientView unexpected response shape: ${parsed.error.message}`,
    );
  }

  return parsed.data.url;
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Creates a DocuSign envelope for the subscription agreement and persists it.
 *
 * @param userId  - Auth identity (User.id).
 * @param vaultId - VaultDeployment.id or vault key.
 * @param amount  - Subscription amount in USDC.
 * @param email   - Authenticated user's real email address (from session).
 *                  Must never be a synthetic `@placeholder.hearst` address.
 *
 * @returns `{ envelopeId, signingUrl }` — the signingUrl is a one-time URL;
 *          the caller must render it immediately (it expires in ~5 min).
 */
export async function createSubscriptionEnvelope(
  userId: string,
  vaultId: string,
  amount: number,
  email: string,
): Promise<CreateSubscriptionEnvelopeResult> {
  // 1. Validate inputs
  const parsed = CreateEnvelopeInputSchema.safeParse({ userId, vaultId, amount, email });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  const { userId: validUserId, vaultId: validVaultId, amount: validAmount, email: validEmail } =
    parsed.data;

  // 2. Load env config
  const { baseUrl, apiKey, accountId } = getDocusignConfig();

  // 3. Derive a return URL — the caller can override this; here we use the app root.
  const returnUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/signed`
      : "https://connect.hearst.app/onboarding/signed";

  // 4. Create envelope with DocuSign
  const { envelopeId } = await docusignCreateEnvelope(
    baseUrl,
    apiKey,
    accountId,
    { userId: validUserId, email: validEmail, vaultId: validVaultId, amount: validAmount },
  );

  // 5. Persist envelope in DB (status = "sent")
  await prisma.subscriptionEnvelope.create({
    data: {
      userId: validUserId,
      vaultId: validVaultId,
      envelopeId,
      status: "sent",
    },
  });

  // 6. Create one-time embedded signing URL
  const signingUrl = await docusignCreateRecipientView(
    baseUrl,
    apiKey,
    accountId,
    envelopeId,
    { userId: validUserId, email: validEmail, returnUrl },
  );

  return { envelopeId, signingUrl };
}
