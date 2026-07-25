import "server-only";

import type {
  AgentMemory,
  AgentTemplate,
  QualificationProfile,
  UserAgentProfile,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { calibratePersona } from "@/lib/agents/calibration";
import { mergeProfileWithTemplate } from "@/lib/agents/user-context";
import { toAnswers } from "@/lib/agents/qualification";
import { loadAllAgentMemory } from "@/lib/agents/memory";

export interface CustomerPositionRow {
  id: string;
  vaultKey: string;
  principalUsdc: number;
  status: string;
  subscribedAt: Date;
}

export interface CustomerChatRow {
  id: string;
  title: string | null;
  updatedAt: Date;
  messageCount: number;
}

export interface CustomerDetail {
  investorId: string;
  userId: string;
  email: string;
  role: string;
  walletAddress: string | null;
  kycStatus: string;
  joinedAt: Date;
  positions: CustomerPositionRow[];
  totalPrincipalUsdc: number;
  qualification: QualificationProfile | null;
  /** Persona suggested by the questionnaire (preview before applying). */
  suggestedPersona: ReturnType<typeof calibratePersona> | null;
  agentProfile: (UserAgentProfile & { template: AgentTemplate | null }) | null;
  memory: AgentMemory[];
  /** The most recent conversations — a CAPPED window (see `chatTotal`). */
  chats: CustomerChatRow[];
  /** REAL total of the investor's conversations — `chats` may be capped below. */
  chatTotal: number;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v) || 0;
}

/**
 * Loads the full admin customer detail for an Investor.id: identity, KYC,
 * positions, qualification (Typeform) answers, the calibrated-vs-applied agent
 * persona, accumulated memory, and recent conversations. Returns null when the
 * investor row (or its User) is missing.
 */
export async function loadCustomerDetail(
  investorId: string,
): Promise<CustomerDetail | null> {
  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    include: {
      positions: {
        orderBy: { subscribedAt: "desc" },
        select: {
          id: true,
          vaultKey: true,
          principalUsdc: true,
          status: true,
          subscribedAt: true,
        },
      },
    },
  });
  if (!investor) return null;

  const user = await prisma.user.findUnique({
    where: { id: investor.userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return null;

  const [qualification, agentProfile, memory, chats, chatTotal] =
    await Promise.all([
      prisma.qualificationProfile.findUnique({ where: { userId: user.id } }),
      prisma.userAgentProfile.findUnique({
        where: {
          userId_agentName: { userId: user.id, agentName: "cockpit-chat" },
        },
        include: { template: true },
      }),
      loadAllAgentMemory(user.id, "cockpit-chat"),
      prisma.cockpitChat.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      // Real total so the view can declare the take:10 window ("Showing X of Y")
      // instead of presenting the cap as the total.
      prisma.cockpitChat.count({ where: { userId: user.id } }),
    ]);

  const positions: CustomerPositionRow[] = investor.positions.map((p) => ({
    id: p.id,
    vaultKey: p.vaultKey,
    principalUsdc: toNumber(p.principalUsdc),
    status: p.status,
    subscribedAt: p.subscribedAt,
  }));

  return {
    investorId: investor.id,
    userId: user.id,
    email: user.email,
    role: user.role,
    walletAddress: investor.walletAddress,
    kycStatus: investor.kycStatus,
    joinedAt: investor.createdAt,
    positions,
    totalPrincipalUsdc: positions.reduce((s, p) => s + p.principalUsdc, 0),
    qualification,
    suggestedPersona: qualification
      ? calibratePersona(toAnswers(qualification))
      : null,
    agentProfile: agentProfile
      ? {
          ...mergeProfileWithTemplate(agentProfile),
          template: agentProfile.template,
        }
      : null,
    memory,
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    })),
    chatTotal,
  };
}
