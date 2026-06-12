import "server-only";

import { DEMO_MARKER, DEMO_POSITION_ID } from "@/lib/dev/investor-demo";
import { prisma } from "@/lib/db";

/** True when this investor holds the seeded demo position (never by email alone). */
export async function investorHasDemoPosition(
  investorId: string,
): Promise<boolean> {
  const row = await prisma.position.findFirst({
    where: { id: DEMO_POSITION_ID, investorId },
    select: { id: true },
  });
  return row !== null;
}

/** True when paper proofs carry the unmistakable demo seed marker. */
export async function databaseHasDemoProofs(): Promise<boolean> {
  const row = await prisma.proof.findFirst({
    where: {
      OR: [
        { postedBy: DEMO_MARKER },
        { notes: DEMO_MARKER },
        { postedBy: { startsWith: DEMO_MARKER } },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}
