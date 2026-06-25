// Agentic Control Center — next architecture steps (static, read-only).
//
// Short, honest roadmap of agentic surfaces that COULD come next. Every entry is
// `status: "planned"` — none of this is built. This is visibility, not a promise.

import type { NextStepItem } from "./types";

const NEXT_STEPS: NextStepItem[] = [
  {
    id: "router-observability-traces",
    title: "Router observability traces",
    why: "Surface the active vs shadow router decision per recent turn (read-only) so admins see what the router actually did, not just static wiring.",
    status: "planned",
  },
  {
    id: "chat-engine-context-composer",
    title: "Chat Engine / Context Composer extraction",
    why: "Split the cockpit-chat route into a reusable engine + context composer so the chat pipeline is testable and inspectable in isolation.",
    status: "planned",
  },
  {
    id: "tool-boundary-split",
    title: "Tool Boundary split",
    why: "Separate read / draft / confirmed tool registries so the boundary is enforced structurally, not only by policy flags.",
    status: "planned",
  },
  {
    id: "reporting-crew-read-only",
    title: "Reporting Crew (read-only)",
    why: "A bounded read-only crew that assembles investor/scenario reports from existing batch-agent outputs — no writes, no sends.",
    status: "planned",
  },
  {
    id: "product-workspace-crew",
    title: "Product Workspace Crew",
    why: "Coordinate framing → scenario → draft as a guided crew while keeping vault creation draft-only and HITL.",
    status: "planned",
  },
  {
    id: "investor-pipeline-crew",
    title: "Investor Pipeline Crew",
    why: "Coordinate scoring → drafting → review across the outreach agents with the send gate untouched (Tier A never auto-sent).",
    status: "planned",
  },
];

export function getNextSteps(): NextStepItem[] {
  return NEXT_STEPS;
}
