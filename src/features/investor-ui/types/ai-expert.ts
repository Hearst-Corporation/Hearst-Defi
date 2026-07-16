// src/features/investor-ui/types/ai-expert.ts
//
// AI-expert advisory block view model. Mirrors hearst-connect-backend AiExpertsSummary
// (hearst-connect-backend/src/domain/index.ts ~L218-221). Kept as a first-class block so
// any screen (Dashboard sidebar, a future dedicated surface) can render its
// slot honestly — this is an ADVISORY signal only, never an autonomous write
// (see CLAUDE.md non-negotiable #4 / ADR-012 / ADR-017): no chat, no
// auto-executed action lives in this type.

import type { ResolvedViewModel } from "./common";

export interface AiExpertViewModel {
  readonly activeExperts: number | null;
  readonly lastSignalAt: string | null; // ISO
  /** Short, human-readable advisory note — never a promise/guarantee word
   *  (forbidden-words list, non-negotiable #5). Always paired with its own
   *  ResolvedViewModel status; render nothing when status is not LIVE-ish. */
  readonly lastSignalSummary: string | null;
}

export type AiExpertResolvedViewModel = ResolvedViewModel<AiExpertViewModel>;
