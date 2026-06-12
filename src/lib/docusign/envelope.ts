"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";

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

const CreateEnvelopeInputSchema = z.object({
  userId: z.string().min(1).max(200),
  vaultId: z.string().min(1).max(200),
  amount: z.number().positive(),
  email: z.string().email().max(320),
});

const DocusignCreateEnvelopeResponseSchema = z.object({
  envelopeId: z.string().min(1),
  status: z.string(),
});

const DocusignRecipientViewSchema = z.object({
  url: z.string().url(),
});

export interface CreateSubscriptionEnvelopeResult {
  envelopeId: string;
  signingUrl: string;
}

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

/**
 * Creates a DocuSign envelope for the subscription agreement and persists it.
 * Consumed by invest/subscribe flows when DocuSign is wired — not onboarding UI.
 */
export async function createSubscriptionEnvelope(
  userId: string,
  vaultId: string,
  amount: number,
  email: string,
): Promise<CreateSubscriptionEnvelopeResult> {
  const parsed = CreateEnvelopeInputSchema.safeParse({ userId, vaultId, amount, email });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  const { userId: validUserId, vaultId: validVaultId, amount: validAmount, email: validEmail } =
    parsed.data;

  const { baseUrl, apiKey, accountId } = getDocusignConfig();

  const returnUrl =
    process.env.NEXT_PUBLIC_APP_URL != null && process.env.NEXT_PUBLIC_APP_URL.length > 0
      ? `${process.env.NEXT_PUBLIC_APP_URL}/profile`
      : "https://connect.hearst.app/profile";

  const { envelopeId } = await docusignCreateEnvelope(
    baseUrl,
    apiKey,
    accountId,
    { userId: validUserId, email: validEmail, vaultId: validVaultId, amount: validAmount },
  );

  await prisma.subscriptionEnvelope.create({
    data: {
      userId: validUserId,
      vaultId: validVaultId,
      envelopeId,
      status: "sent",
    },
  });

  const signingUrl = await docusignCreateRecipientView(
    baseUrl,
    apiKey,
    accountId,
    envelopeId,
    { userId: validUserId, email: validEmail, returnUrl },
  );

  return { envelopeId, signingUrl };
}
