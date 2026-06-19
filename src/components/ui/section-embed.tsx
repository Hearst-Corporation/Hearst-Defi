"use client";

import { createContext, useContext, type ReactNode } from "react";

const SectionEmbedContext = createContext(false);

/** Signals child widgets to omit module chrome (inside ProductSection). */
function SectionEmbedProvider({ children }: { children: ReactNode }) {
  return (
    <SectionEmbedContext.Provider value={true}>
      {children}
    </SectionEmbedContext.Provider>
  );
}

/**
 * @deprecated No current consumer (kept intentionally in 4d7fe4f for a possible
 * ProductSection embed refactor). If that refactor is dropped, delete this file.
 * knip flags it as unused — that is expected, not a regression.
 */
export function useSectionEmbed(): boolean {
  return useContext(SectionEmbedContext);
}
