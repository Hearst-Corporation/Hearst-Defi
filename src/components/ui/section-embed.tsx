"use client";

import { createContext, useContext, type ReactNode } from "react";

const SectionEmbedContext = createContext(false);

/** Signals child widgets to omit module chrome (inside ProductSection). */
export function SectionEmbedProvider({ children }: { children: ReactNode }) {
  return (
    <SectionEmbedContext.Provider value={true}>
      {children}
    </SectionEmbedContext.Provider>
  );
}

export function useSectionEmbed(): boolean {
  return useContext(SectionEmbedContext);
}
