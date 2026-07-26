"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Segmented — « choisis-en un parmi N », avec une pastille qui GLISSE.
 *
 * ── Pourquoi pas framer-motion / `layoutId` ─────────────────────────────────
 * C'est la réponse réflexe à ce composant, et elle est deux fois mauvaise ici.
 * D'abord framer-motion a été retiré du repo — le réintroduire pour une pastille
 * ferait rentrer ~33,6 kB gz dans le bundle de chaque page qui affiche un
 * filtre. Ensuite `layoutId` résout un problème qu'on n'a pas : il interpole
 * entre deux éléments DÉMONTÉS/REMONTÉS à des endroits arbitraires du DOM. Ici
 * la pastille est UN seul élément qui se déplace sur UN seul axe, entre des
 * positions qu'on peut mesurer exactement. Un `translateX` mesuré fait le
 * travail en zéro dépendance, et le compositeur ne repeint rien.
 *
 * ── Pourquoi la mesure, et pas des largeurs en pourcentage ──────────────────
 * Les segments n'ont pas la même largeur (« 24 h » vs « Depuis le début »), et
 * la police est variable : une largeur calculée à la main serait fausse au
 * premier changement de libellé et au chargement de Satoshi. On mesure donc au
 * `useLayoutEffect` (avant la peinture, donc sans saut visible) et on re-mesure
 * sous `ResizeObserver` — conteneur ET boutons, parce que c'est la largeur des
 * boutons qui bouge quand la police arrive.
 */

export interface SegmentedItem<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  items: ReadonlyArray<SegmentedItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** REQUIS : sans nom de groupe, l'AT annonce N boutons orphelins. */
  ariaLabel: string;
  /**
   * `radiogroup` (défaut) = on choisit une VALEUR.
   * `tablist` = on change de VUE — à ne prendre que si des panneaux existent
   * réellement, sinon on promet à l'AT des `tabpanel` introuvables.
   */
  variant?: "radiogroup" | "tablist";
  className?: string;
}

/**
 * Contrat clavier APAC : Flèches (cyclique), Home, Début / End, Fin.
 * Extrait en fonction pure : c'est la seule façon de le tester sous
 * `environment: "node"`, où il n'y a ni DOM ni évènement clavier.
 *
 * @returns l'index cible, ou `null` si la touche ne nous concerne pas — auquel
 *          cas on ne doit SURTOUT pas appeler preventDefault (Tab, ⌘K…).
 */
export function nextSegmentedIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count <= 0 || current < 0 || current >= count) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * `useLayoutEffect` côté navigateur, `useEffect` au rendu serveur. Le choix est
 * figé au chargement du module, donc l'ordre des hooks ne varie jamais dans un
 * même environnement. Sans ça, React émet un avertissement à chaque rendu SSR
 * (« useLayoutEffect does nothing on the server ») — bruit garanti dans les
 * tests, qui rendent ce composant via renderToStaticMarkup.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type PillBox = { x: number; w: number };

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "radiogroup",
  className,
}: SegmentedProps<T>) {
  const isTablist = variant === "tablist";
  const trackRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // `null` = PAS ENCORE MESURÉ. La pastille n'est pas rendue dans cet état :
  // c'est ce qui évite le flash d'une pastille à x=0/largeur 0 au premier
  // rendu, avant que la mesure n'existe.
  const [pill, setPill] = useState<PillBox | null>(null);

  const activeIndex = items.findIndex((it) => it.value === value);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const btn = activeIndex >= 0 ? btnRefs.current[activeIndex] : null;
    if (!track || !btn) {
      setPill(null);
      return;
    }
    const t = track.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const x = b.left - t.left;
    const w = b.width;
    // On conserve l'objet précédent à l'identique quand rien n'a bougé : sans
    // ça, chaque notification du ResizeObserver déclencherait un rendu, qui
    // peut lui-même retoucher la mise en page — la boucle classique.
    setPill((prev) => (prev && prev.x === x && prev.w === w ? prev : { x, w }));
  }, [activeIndex]);

  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, items.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    for (const btn of btnRefs.current) if (btn) ro.observe(btn);
    return () => ro.disconnect();
  }, [measure, items.length]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const next = nextSegmentedIndex(e.key, activeIndex, items.length);
    if (next === null) return;
    e.preventDefault();
    const target = items[next];
    if (!target) return;
    // Le focus SUIT la sélection : c'est la moitié non négociable du roving
    // tabindex. Sans ça le seul `tabIndex=0` de la barre se retrouve sur un
    // bouton qui n'a pas le focus, et la navigation devient intraçable.
    btnRefs.current[next]?.focus();
    if (target.value !== value) onChange(target.value);
  }

  return (
    <div
      role={isTablist ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className={cn("inline-flex", className)}
    >
      <div
        ref={trackRef}
        className="relative inline-flex items-center rounded-lg border border-border-subtle bg-surface-inset p-1"
      >
        {pill ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 left-0 rounded-md",
              "bg-surface-card shadow-xs",
              "transition-[transform,width] duration-(--dur-base) ease-standard",
            )}
            style={{
              width: pill.w,
              transform: `translateX(${pill.x}px)`,
              // `will-change` est LÉGITIME ici, contrairement aux tuiles KPI :
              // un élément unique, promu une fois, animé à chaque changement de
              // segment pendant toute la vie de la page. La largeur est animée
              // avec — l'alternative (scaleX) déformerait le rayon des coins, et
              // cet élément est en position absolue : aucun voisin ne dépend de
              // sa mise en page.
              willChange: "transform",
            }}
          />
        ) : null}

        {items.map((it, i) => {
          const active = it.value === value;
          const selectionAttrs = isTablist
            ? { "aria-selected": active }
            : { "aria-checked": active };
          return (
            <button
              key={it.value}
              type="button"
              role={isTablist ? "tab" : "radio"}
              // Roving tabindex : un seul arrêt de tabulation pour tout le
              // groupe, sur l'élément sélectionné.
              tabIndex={active ? 0 : -1}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              onClick={() => {
                if (!active) onChange(it.value);
              }}
              className={cn(
                // z-10 : au-dessus de la pastille, qui est un frère absolu.
                "relative z-10 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                "transition-colors duration-(--dur-fast) ease-standard",
                // La sélection reste SOBRE : c'est la pastille qui la porte, pas
                // un remplissage d'accent — le vert est réservé à l'action
                // primaire, jamais à « où je suis ».
                active ? "text-foreground" : "text-muted hover:text-foreground",
              )}
              {...selectionAttrs}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
