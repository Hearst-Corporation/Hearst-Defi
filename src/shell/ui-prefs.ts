/**
 * Préférences d'interface persistées : thème et état du rail.
 *
 * POURQUOI UN COOKIE ET UN SCRIPT INLINE, ET PAS `next-themes`
 * Lire un cookie dans le root layout rendrait DYNAMIQUES toutes les routes, y
 * compris `/`, `/login` et `/legal/*` qui sont aujourd'hui statiquement
 * optimisables — un coût réel pour un gain nul, puisqu'un script exécuté avant
 * la première peinture supprime le flash aussi bien.
 *
 * Le serveur ne rend AUCUN attribut de thème : c'est ce qui garantit qu'aucune
 * incohérence d'hydratation ne peut exister. Le script pose `data-theme` sur
 * `<html>` avant que le parseur n'atteigne le contenu suivant.
 *
 * Un seul mécanisme pour deux préférences (thème + rail), lisible côté serveur
 * le jour où une route déjà dynamique voudrait pré-rendre son thème.
 */

export const THEME_COOKIE = "hc-theme";
export const SIDEBAR_COOKIE = "hc-sidebar";

/** `system` suit l'OS ; `light`/`dark` forcent. Défaut sans cookie : `dark`. */
export type ThemeChoice = "system" | "light" | "dark";

/** Thème effectivement appliqué au document (jamais `system`). */
export type ResolvedTheme = "light" | "dark";

export const THEME_ORDER: readonly ThemeChoice[] = ["system", "light", "dark"];

/** Écrit une préférence. Un an, SameSite=Lax, lisible par le client. */
export function writePref(name: string, value: string): void {
  document.cookie =
    `${name}=${value}; path=/; max-age=31536000; samesite=lax` +
    (location.protocol === "https:" ? "; secure" : "");
}

export function readPref(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return choice;
}

/**
 * Applique un thème au document, avec une transition BRÈVE posée le temps du
 * basculement seulement (voir palette.css §6). Une transition permanente sur
 * `background-color` ralentirait chaque survol de l'application.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement;
  el.dataset.themeSwitching = "";
  el.dataset.theme = resolved;
  el.style.colorScheme = resolved;
  window.setTimeout(() => {
    delete el.dataset.themeSwitching;
  }, 160);
}

/**
 * Script de boot — sérialisé tel quel dans le HTML et exécuté AVANT la première
 * peinture. Il n'importe rien, ne dépend d'aucun bundle, et ne peut pas casser
 * l'hydratation puisque le serveur ne rend aucun attribut de thème.
 *
 * Le `catch` retombe sur `dark` : en cas de cookie corrompu ou de
 * `matchMedia` indisponible, on ne laisse jamais le document sans thème.
 */
export const UI_PREFS_BOOT = `(function(){try{
var d=document,e=d.documentElement,c=d.cookie;
function g(k){var m=c.match(new RegExp('(?:^|; )'+k+'=([^;]*)'));return m?m[1]:null}
var t=g('${THEME_COOKIE}')||'dark';
if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
e.dataset.theme=t;
e.style.colorScheme=t;
if(g('${SIDEBAR_COOKIE}')==='collapsed')e.dataset.sidebar='collapsed';
}catch(_){document.documentElement.dataset.theme='dark'}})()`;
