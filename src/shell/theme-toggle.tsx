"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import {
  applyTheme,
  readPref,
  resolveTheme,
  THEME_COOKIE,
  THEME_ORDER,
  writePref,
  type ThemeChoice,
} from "@/shell/ui-prefs";

const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

const LABEL: Record<ThemeChoice, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

/**
 * S'abonne à l'attribut `data-theme` du document — la source de vérité est le
 * DOM, posé par le script de boot avant la première peinture, et non un état
 * React qui arriverait une frame trop tard.
 */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", onChange);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  // Snapshot serveur = "dark" : seule l'ICÔNE peut se corriger d'une frame,
  // jamais la couleur — le script de boot a déjà posé data-theme.
  const applied = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? "dark",
    () => "dark",
  );

  const cycle = useCallback(() => {
    const current = (readPref(THEME_COOKIE) ?? "dark") as ThemeChoice;
    const next =
      THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]!;
    writePref(THEME_COOKIE, next);
    applyTheme(resolveTheme(next));
  }, []);

  const Icon = ICON[applied === "light" ? "light" : "dark"];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[applied === "light" ? "light" : "dark"]} — switch theme`}
      title="Switch theme"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-subtle",
        "transition-colors duration-(--dur-fast) ease-standard",
        "hover:bg-surface-raised hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
