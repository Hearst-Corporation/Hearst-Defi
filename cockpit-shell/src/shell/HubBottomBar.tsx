"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../stores/activeProductStore";
import { useCockpit } from "./context";

/**
 * HubBottomBar — barre menu flottante en bas, visible uniquement sur le hub
 * (jamais en mode produit). Bouton Overview = retour au dashboard.
 *
 * Apparence : bento Tailwind (canon Portfolio), accent vert unique #A7FB90.
 * Le marqueur de classe `ct-hub-bar` est conservé uniquement comme hook pour la
 * suppression côté app (`cockpit.css` masque la barre native via `display:none`,
 * la navigation vivant dans le rail gauche) — il ne porte plus aucun style.
 * Le centrage flottant est calculé sur les variables de rail via `style`
 * inline (calc rail-aware non exprimable en classes utilitaires).
 */
export function HubBottomBar() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(appId);

  const [pathname, setPathname] = useState<string>("/");
  useEffect(() => {
    setPathname(window.location.pathname);
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  if (active !== appId) return null;

  const onOverview = pathname === "/";

  return (
    <div
      className="ct-hub-bar absolute z-30 inline-flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-[#0B0E10]/95 px-4 py-2.5 shadow-lg backdrop-blur"
      style={{
        bottom: 24,
        left: "calc((var(--ct-rail-left) + 100vw - var(--ct-rail-right-eff)) / 2)",
      }}
    >
      <span className="inline-flex items-center gap-2 whitespace-nowrap pl-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: product.color }}
        />
        Cockpit
      </span>
      <div className="flex items-center gap-1 rounded-full border border-white/5 bg-black/20 p-1">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-[10px] font-medium uppercase tracking-widest transition-colors duration-150 ${
            onOverview
              ? "bg-white/5 text-[#A7FB90]"
              : "text-zinc-400 hover:text-white"
          }`}
          onClick={() => {
            if (!onOverview) window.location.href = "/";
          }}
        >
          Overview
        </button>
      </div>
    </div>
  );
}
