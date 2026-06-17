import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { prisma } from "@/lib/db";
import type {
  RoadmapDocument,
  RoadmapItemWithState,
  RoadmapPhaseWithState,
  RoadmapStatus,
  RoadmapWeekWithState,
} from "@/lib/roadmap-types";

/**
 * Runtime schema for docs/roadmap.json. Only the fields actually consumed
 * downstream are validated; the parsed shape stays assignable to
 * RoadmapDocument so the public return type is unchanged.
 */
const roadmapItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  owner: z.string(),
  spec_ref: z.string().nullable(),
});

const roadmapWeekSchema = z.object({
  id: z.string(),
  label: z.string(),
  items: z.array(roadmapItemSchema),
});

const roadmapPhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  weeks: z.array(roadmapWeekSchema),
});

const roadmapSchema = z.object({
  version: z.string(),
  phases: z.array(roadmapPhaseSchema),
});

const ROADMAP_PATH = path.join(process.cwd(), "docs", "roadmap.json");
const DONE_LIKE: RoadmapStatus[] = ["done", "validated"];

async function loadRoadmapFromDisk(): Promise<RoadmapDocument> {
  try {
    const raw = await fs.readFile(ROADMAP_PATH, "utf8");
    return roadmapSchema.parse(JSON.parse(raw));
  } catch (err) {
    // File absent, unreadable, or structurally invalid — return a typed empty
    // document so /admin/roadmap renders an honest empty state rather than
    // hitting the error boundary.
    console.warn("[roadmap] failed to load docs/roadmap.json, serving empty:", err);
    return { version: "0.0.0", phases: [] };
  }
}

export async function getRoadmap(): Promise<{
  version: string;
  phases: RoadmapPhaseWithState[];
}> {
  const doc = await loadRoadmapFromDisk();
  const validations = await prisma.roadmapValidation.findMany();
  const byId = new Map(validations.map((v) => [v.itemId, v]));

  const phases: RoadmapPhaseWithState[] = doc.phases.map((phase) => {
    let phaseTotal = 0;
    let phaseDone = 0;

    const weeks: RoadmapWeekWithState[] = phase.weeks.map((week) => {
      let doneCount = 0;
      const items: RoadmapItemWithState[] = week.items.map((item) => {
        const v = byId.get(item.id);
        const status: RoadmapStatus = (v?.status as RoadmapStatus) ?? "todo";
        if (DONE_LIKE.includes(status)) doneCount += 1;
        return {
          ...item,
          status,
          validatedBy: v?.validatedBy ?? null,
          validatedAt: v?.validatedAt ?? null,
          notes: v?.notes ?? null,
          blockers: v?.blockers ?? null,
          evidenceUrl: v?.evidenceUrl ?? null,
          updatedAt: v?.updatedAt ?? null,
        };
      });
      phaseTotal += items.length;
      phaseDone += doneCount;
      return { ...week, items, total: items.length, doneCount };
    });

    return {
      ...phase,
      weeks,
      total: phaseTotal,
      doneCount: phaseDone,
    };
  });

  return { version: doc.version, phases };
}
