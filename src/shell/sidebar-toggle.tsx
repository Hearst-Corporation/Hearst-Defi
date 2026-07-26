"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { SIDEBAR_COOKIE, writePref } from "@/shell/ui-prefs";

/**
 * S'abonne à l'attribut `data-sidebar` du document.
 *
 * Comme pour le thème, la source de vérité est le DOM : l'état initial est posé
 * par le script de boot AVANT la première peinture. Un flash de layout (la
 * grille qui saute d'une largeur à l'autre) est bien plus visible qu'un flash
 * de couleur, donc il ne peut pas dépendre d'un état React arrivant après
 * l'hydratation.
 */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributeFilter: ["data-sidebar"] });
  return () => mo.disconnect();
}

export function SidebarToggle({ className }: { className?: string }) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.sidebar === "collapsed",
    // Snapshot serveur : déployé. Seul l'`aria-expanded` peut se corriger d'une
    // frame — jamais la largeur, déjà résolue en CSS par le script de boot.
    () => false,
  );

  const toggle = useCallback(() => {
    const el = document.documentElement;
    // Sous 1024 px le rail est un tiroir hors flux : son ouverture est
    // éphémère et ne se persiste pas (rouvrir la page ne doit pas rouvrir un
    // panneau qui masque le contenu).
    if (window.matchMedia("(max-width: 63.999rem)").matches) {
      if (el.dataset.sidebar === "open") delete el.dataset.sidebar;
      else el.dataset.sidebar = "open";
      return;
    }
    const next = el.dataset.sidebar === "collapsed" ? "" : "collapsed";
    if (next) el.dataset.sidebar = next;
    else delete el.dataset.sidebar;
    writePref(SIDEBAR_COOKIE, next || "expanded");
  }, []);

  // ⌘\ / Ctrl+\ — convention Linear et VS Code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls="main-content"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={`${collapsed ? "Expand" : "Collapse"} sidebar (⌘\\)`}
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

/** Voile de fermeture du tiroir mobile. Rendu seulement sous 1024 px (CSS). */
export function SidebarScrim() {
  const close = useCallback(() => {
    delete document.documentElement.dataset.sidebar;
  }, []);
  return (
    <div
      onClick={close}
      aria-hidden
      className="hc-scrim"
      data-testid="sidebar-scrim"
    />
  );
}
