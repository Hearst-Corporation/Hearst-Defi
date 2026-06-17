/**
 * Dev helper: seed the first AgentTemplate (persona library) if none exists.
 *
 *   pnpm tsx scripts/create-agent-template.ts
 *
 * Optionally assigns the template to LP_EMAIL's cockpit-chat profile.
 */
import { makePrismaClient } from "./lib/prisma-cli";

const DEFAULT_TEMPLATE = {
  slug: "lp-institutional-fr",
  label: "LP institutionnel FR",
  description:
    "Family office / wealth platform — registre feutré, méthodologie, fourchettes APY, structure Cayman.",
  baseAgent: "cockpit-chat",
  tone: "detailed",
  language: "fr",
  verbosity: "medium",
  systemAdditions:
    "Interlocuteur institutionnel francophone : vocabulaire structuré (fourchette APY, méthodologie v1.0, " +
    "provenance Live/Oracle/Attested), structure Cayman SPV, ticket minimum 250k USDC, lock-up 60 jours. " +
    "Reste factuel — aucune promesse de rendement, toujours « non garanti ».",
} as const;

const LP_EMAIL = process.env.LP_EMAIL?.trim() ?? "lp.demo@hearstcorporation.io";

async function main(): Promise<void> {
  const prisma = makePrismaClient();
  try {
    const existing = await prisma.agentTemplate.findUnique({
      where: { slug: DEFAULT_TEMPLATE.slug },
    });

    const template =
      existing ??
      (await prisma.agentTemplate.create({
        data: { ...DEFAULT_TEMPLATE },
      }));

    if (existing) {
      console.log(`[create-agent-template] already exists: ${template.id} (${template.slug})`);
    } else {
      console.log(`[create-agent-template] created: ${template.id} (${template.slug})`);
    }

    const user = await prisma.user.findUnique({
      where: { email: LP_EMAIL },
      select: { id: true },
    });

    if (user) {
      await prisma.userAgentProfile.upsert({
        where: {
          userId_agentName: { userId: user.id, agentName: "cockpit-chat" },
        },
        create: {
          userId: user.id,
          agentName: "cockpit-chat",
          templateId: template.id,
        },
        update: { templateId: template.id },
      });
      console.log(`[create-agent-template] assigned to ${LP_EMAIL}`);
    } else {
      console.log(`[create-agent-template] LP not found (${LP_EMAIL}) — template only, no assign`);
    }

    const total = await prisma.agentTemplate.count({ where: { archived: false } });
    console.log(`[create-agent-template] active templates: ${total}`);
    console.log(`[create-agent-template] admin: /admin/agents/${template.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[create-agent-template] failed:", err);
  process.exit(1);
});
