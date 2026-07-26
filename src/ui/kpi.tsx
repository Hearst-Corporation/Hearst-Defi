import { Children, cloneElement, isValidElement } from "react";

import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/ui/badge";

/**
 * Kpi — la tuile de métrique du produit.
 *
 * MISSION P3-2 : cet enrichissement est STRICTEMENT ADDITIF. Les 13 vues qui
 * rendent déjà `<Kpi>` (7 admin, 5 investor, 1 dashboard) n'ont pas bougé d'une
 * ligne, et leur DOM est figé au caractère près par
 * `src/ui/__tests__/kpi-contract.test.tsx`. Toute prop nouvelle est optionnelle
 * et sa valeur par défaut REPRODUIT le rendu d'avant :
 *   - `state` vaut "ready"      → aucun squelette, aucun motif ;
 *   - `trend` absent            → on retombe sur le booléen `delta.positive` ;
 *   - `spark` absent            → aucun <svg> ;
 *   - `index` absent            → AUCUNE animation d'entrée (voir plus bas) ;
 *   - `href` absent             → la racine reste un <div>, sans survol.
 *
 * ── PAS DE COMPTEUR ANIMÉ (décision de doctrine, pas un oubli) ───────────────
 * La tentation classique sur une tuile de KPI est d'animer le montant de 0 vers
 * sa valeur. On ne le fait pas, et on ne le fera pas : pendant les ~400 ms de
 * l'interpolation, la tuile affiche des CHIFFRES FAUX — un principal, un solde
 * BTC, un hashrate que personne n'a jamais mesurés. Sur un produit dont tout le
 * data layer refuse le zéro fabriqué (« un champ absent = unavailable avec sa
 * raison, jamais 0 »), faire transiter chaque montant réel PAR zéro serait la
 * même faute, déplacée dans la couche de présentation. L'entrée `animate-rise`
 * (opacité + 4 px) donne le même confort perçu sans jamais afficher une valeur
 * qui n'existe pas.
 */

/** Direction d'une variation. `flat` = neutre — ce que le booléen
 *  `delta.positive` ne sait pas exprimer (il n'a que vrai/faux). */
export type KpiTrend = "up" | "down" | "flat";

/** `ready` = rendu historique. Les deux autres sont les états honnêtes. */
export type KpiState = "ready" | "loading" | "unavailable";

export interface KpiProps {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  provenance?: React.ComponentProps<typeof ProvenanceBadge>["source"];
  hint?: string;
  className?: string;
  /** Direction de la variation. PRIORITAIRE sur `delta.positive`. */
  trend?: KpiTrend;
  /** Série de contexte. < 2 points ⇒ rien n'est dessiné (cf. `sparkPath`). */
  spark?: readonly number[];
  /** Défaut `ready` — strictement le rendu d'avant P3-2. */
  state?: KpiState;
  /** Le MOTIF de l'indisponibilité. Jamais un tiret muet, jamais « 0 ». */
  unavailableReason?: string;
  /** Rang dans la grille : décale l'entrée. Absent ⇒ aucune animation. */
  index?: number;
  /** Drill-down : la racine devient un <a> et gagne son affordance. */
  href?: string;
}

/* ── Tonalité ───────────────────────────────────────────────────────────────
 * Doctrine : un seul vert, zéro rouge. Une baisse n'est donc PAS rouge — elle
 * est grise, comme l'absence. `down` et `flat` partagent la même couleur ; ce
 * qui les distingue est le glyphe, jamais la teinte. C'est aussi la bonne
 * pratique d'accessibilité : la direction n'est pas portée par la couleur. */
function deltaTone(trend: KpiTrend | undefined, positive: boolean | undefined) {
  if (trend) return trend === "up" ? "text-accent-ink" : "text-muted";
  return positive ? "text-accent-ink" : "text-muted";
}

const TREND_GLYPH: Record<KpiTrend, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

/** Doublure textuelle du glyphe : l'AT lit la direction même si la police ne
 *  rend pas la flèche, et on ne dépend jamais du seul caractère. */
const TREND_SR: Record<KpiTrend, string> = {
  up: "up",
  down: "down",
  flat: "unchanged",
};

/** Ce qu'on affiche quand l'appelant déclare `unavailable` SANS motif. On dit
 *  que la raison manque — on n'en invente pas une, et surtout on n'affiche pas
 *  un tiret qui laisserait croire à une valeur vide plutôt qu'à un trou. */
export const KPI_UNAVAILABLE_FALLBACK = "Unavailable — no reason reported";

/* ── Sparkline : SVG PUR, pas Recharts ──────────────────────────────────────
 * Recharts est le moteur canonique des graphiques du produit et le reste. Il
 * n'a simplement rien à faire ICI : quatre sparklines de 64×20 px sur une
 * rangée de KPI, c'est ~152 kB gz de moteur + quatre stores Redux internes, et
 * surtout la bascule de la tuile — donc de la page — en Client Component. Le
 * tracé ci-dessous fait 35 lignes, ne pèse rien, et laisse `Kpi` server-side.
 */

const SPARK_W = 64;
const SPARK_H = 20;
/** Demi-épaisseur du trait : sans cette marge, les extrêmes sont rognés. */
const SPARK_PAD = 1;

type Pt = { x: number; y: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * Catmull-Rom → Bézier cubique, AVEC BORNAGE DES POINTS DE CONTRÔLE.
 *
 * Le Catmull-Rom nu dépasse : sur une série qui monte puis se stabilise, il
 * dessine un sommet PLUS HAUT que la plus haute valeur mesurée. Sur une donnée
 * financière c'est un mensonge graphique — la courbe affirme un pic que la
 * série ne contient pas. On borne donc chaque point de contrôle dans le
 * rectangle du segment qu'il gouverne : une Bézier reste dans l'enveloppe
 * convexe de ses 4 points, donc si p1.y, c1.y, c2.y et p2.y sont tous dans
 * [min(p1,p2), max(p1,p2)], la courbe entière y reste aussi. Aucun sommet
 * inventé, propriété démontrable — et testée.
 *
 * @returns le `d` du path, ou `null` s'il n'y a pas de tendance à montrer.
 */
function sparkPath(values: readonly number[]): string | null {
  // Un point (ou zéro) n'est PAS une tendance. On ne dessine rien plutôt qu'un
  // trait plat qui se lirait comme « stable » alors qu'on ne sait rien.
  if (values.length < 2) return null;
  // Un NaN/Infinity est un trou, pas une valeur : on refuse toute la série
  // plutôt que de le rabattre silencieusement sur 0.
  if (!values.every((v) => Number.isFinite(v))) return null;

  let min = values[0] as number;
  let max = values[0] as number;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const span = max - min;
  const stepX = SPARK_W / (values.length - 1);
  const usableH = SPARK_H - SPARK_PAD * 2;

  const pts: Pt[] = values.map((v, i) => ({
    x: i * stepX,
    // span === 0 : série parfaitement plate. Ligne à mi-hauteur — et surtout
    // pas une division par zéro.
    y:
      span === 0
        ? SPARK_H / 2
        : SPARK_PAD + usableH - ((v - min) / span) * usableH,
  }));

  const first = pts[0];
  if (!first) return null;
  // Bornage d'indice : les extrémités se dupliquent (tangente miroir), ce qui
  // évite un `!` et satisfait noUncheckedIndexedAccess.
  const at = (i: number): Pt => pts[clamp(i, 0, pts.length - 1)] ?? first;

  let d = `M${round2(first.x)} ${round2(first.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const loY = Math.min(p1.y, p2.y);
    const hiY = Math.max(p1.y, p2.y);
    const c1x = clamp(p1.x + (p2.x - p0.x) / 6, p1.x, p2.x);
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, loY, hiY);
    const c2x = clamp(p2.x - (p3.x - p1.x) / 6, p1.x, p2.x);
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, loY, hiY);
    d += `C${round2(c1x)} ${round2(c1y)} ${round2(c2x)} ${round2(c2y)} ${round2(p2.x)} ${round2(p2.y)}`;
  }
  return d;
}

/** Exposé pour le test de non-dépassement — pas d'API publique au-delà. */
export const __sparkPathForTest = sparkPath;

function Sparkline({ values }: { values: readonly number[] }) {
  const d = sparkPath(values);
  if (!d) return null;
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      // preserveAspectRatio="none" est ASSUMÉ : la courbe s'étire sur toute la
      // largeur de la tuile, qui varie avec le nombre de colonnes. C'est licite
      // ici parce qu'on ne LIT aucune valeur dessus — c'est une forme, pas une
      // mesure ; le chiffre exact est juste au-dessus. En contrepartie
      // `vectorEffect="non-scaling-stroke"` empêche l'étirement non uniforme
      // d'épaissir le trait horizontalement.
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      // `text-faint` est le rôle NON-TEXTUEL (3,4:1) : exactement le contrat
      // WCAG d'un objet graphique. Volontairement pas l'accent — quatre courbes
      // vertes sur une rangée transformeraient le seul accent en papier peint.
      className="mt-1 h-5 w-full text-faint"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Squelette ──────────────────────────────────────────────────────────────
 * GÉOMÉTRIE IDENTIQUE à l'état chargé, sinon le passage loading → ready fait
 * sauter la grille. Les hauteurs ne sont pas décoratives, elles recopient les
 * line-heights de theme.css :
 *   label  .hc-metric-label  text-2xs → 1rem      → h-4
 *   valeur .hc-metric-value  text-2xl → 2rem      → h-8
 *   hint   text-xs           → 1.125rem           → h-4.5
 *   spark  .h-5 + .mt-1                           → h-5 mt-1
 * L'écart vertical est le même `gap-1` que la tuile chargée.
 * Verrouillé par kpi-contract.test.tsx. */
const SKELETON_H = {
  label: "h-4",
  value: "h-8",
  hint: "h-4.5",
  spark: "h-5",
} as const;

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-overlay",
        className,
      )}
    >
      {/* Le sheen voyage en `foreground/5` et non en « une surface plus
          claire » : en thème clair, plus clair que la barre n'existe pas. Une
          bande de CONTRASTE fonctionne dans les deux thèmes sans dupliquer la
          règle. */}
      <span className="absolute inset-0 animate-sheen bg-linear-to-r from-transparent via-foreground/5 to-transparent" />
    </div>
  );
}

/* ── Entrée échelonnée ──────────────────────────────────────────────────────
 * `min(index, 3) * 40 ms`. Le plafond n'est pas cosmétique : au-delà du 4ᵉ
 * rang, le décalage cumulé cesse de se lire comme une cascade et commence à se
 * lire comme de la LENTEUR — la 8ᵉ tuile arriverait 320 ms après la 1ʳᵉ. On
 * plafonne donc, et les tuiles suivantes entrent avec la 4ᵉ. */
const STAGGER_STEP_MS = 40;
const STAGGER_MAX_RANK = 3;

function staggerDelay(index: number): string {
  return `${Math.min(Math.max(Math.trunc(index), 0), STAGGER_MAX_RANK) * STAGGER_STEP_MS}ms`;
}

/* ── Survol (uniquement si `href`) ──────────────────────────────────────────
 * Deux propriétés seulement, toutes deux composées : `border-color` et
 * `transform`. L'ombre, elle, NE S'ANIME PAS en `box-shadow` — animer une
 * box-shadow repeint toute la boîte à chaque frame. Elle est posée en dur sur
 * un `::after` et c'est son OPACITÉ qui voyage : le compositeur s'en charge,
 * la boîte n'est jamais repeinte.
 *
 * PAS DE `will-change` ici, délibérément : promouvoir quatre couches en
 * permanence pour un survol de 150 ms coûte plus de mémoire GPU que ça ne fait
 * gagner de frames. (`will-change` est en revanche légitime sur la pastille de
 * `src/ui/segmented.tsx` : un seul élément, animé en continu.)
 *
 * `-m-2 p-2` : la zone de survol respire de 8 px SANS déplacer d'un pixel le
 * contenu — la marge négative annule exactement le padding. */
const INTERACTIVE = [
  "relative -m-2 rounded-lg border border-transparent p-2",
  "transition-[border-color,transform] duration-(--dur-fast) ease-standard",
  "hover:-translate-y-px hover:border-border",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit]",
  "after:shadow-md after:opacity-0",
  "after:transition-opacity after:duration-(--dur-fast) after:ease-standard",
  "hover:after:opacity-100",
];

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="ml-auto size-3 shrink-0 text-faint"
    >
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  delta,
  provenance,
  hint,
  className,
  trend,
  spark,
  state = "ready",
  unavailableReason,
  index,
  href,
}: KpiProps) {
  // Racine : `flex flex-col gap-1` EN TÊTE et rien d'autre quand aucune option
  // n'est active — c'est la classe exacte d'avant P3-2.
  const rootClass = cn(
    "flex flex-col gap-1",
    href && state === "ready" && INTERACTIVE,
    index !== undefined && "animate-rise",
    className,
  );
  const rootStyle =
    index !== undefined ? { animationDelay: staggerDelay(index) } : undefined;

  /* ── loading ──────────────────────────────────────────────────────────── */
  if (state === "loading") {
    return (
      <div className={rootClass} style={rootStyle} aria-busy="true">
        {/* Les barres sont muettes ; le seul texte lu est celui-ci, pour que
            l'AT sache CE QUI charge et pas seulement « qu'il se passe quelque
            chose ». */}
        <span className="sr-only">{`${label} — loading`}</span>
        <Bar className={cn(SKELETON_H.label, "w-24 animate-skeleton-in")} />
        <Bar className={cn(SKELETON_H.value, "w-32 animate-skeleton-in")} />
        {spark && spark.length >= 2 ? (
          <Bar className={cn(SKELETON_H.spark, "mt-1 w-full animate-skeleton-in")} />
        ) : null}
        {hint ? (
          <Bar className={cn(SKELETON_H.hint, "w-20 animate-skeleton-in")} />
        ) : null}
      </div>
    );
  }

  /* ── unavailable ──────────────────────────────────────────────────────── */
  if (state === "unavailable") {
    return (
      <div className={rootClass} style={rootStyle}>
        <div className="flex items-center gap-2">
          <span className="hc-metric-label">{label}</span>
          {/* `stale` et non l'éventuelle provenance passée par l'appelant : la
              donnée n'est pas là, sa provenance d'origine ne veut plus rien
              dire. Et `stale` n'est pas rouge — une donnée qui manque n'est pas
              une erreur (cf. provenance-contract.test.ts). */}
          <ProvenanceBadge source="stale" />
        </div>
        {/* `min-h-8` = la hauteur de .hc-metric-value : la tuile indisponible
            occupe la même place que ses voisines, la rangée reste droite.
            Aucun « 0 », aucun « — » : on affiche LE MOTIF. */}
        <p className="flex min-h-8 items-center text-sm text-muted">
          {unavailableReason || KPI_UNAVAILABLE_FALLBACK}
        </p>
        {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
      </div>
    );
  }

  /* ── ready ────────────────────────────────────────────────────────────── */
  const tone = deltaTone(trend, delta?.positive);

  // Deux branches VOLONTAIREMENT distinctes : celle du bas est le nœud legacy,
  // rendu au caractère près comme avant. On ne la factorise pas avec la branche
  // `trend` — c'est ce qui garantit l'identité du DOM des 13 appelants.
  const deltaNode = trend ? (
    <span className={cn("text-xs font-medium tabular-nums", tone)}>
      <span aria-hidden="true">{TREND_GLYPH[trend]}</span>
      <span className="sr-only">{TREND_SR[trend]}</span>
      {delta ? delta.value : null}
    </span>
  ) : delta ? (
    <span className={cn("text-xs font-medium tabular-nums", tone)}>
      {delta.value}
    </span>
  ) : null;

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="hc-metric-label">{label}</span>
        {provenance ? <ProvenanceBadge source={provenance} /> : null}
        {href ? <Chevron /> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="hc-metric-value">{value}</span>
        {deltaNode}
      </div>
      {spark ? <Sparkline values={spark} /> : null}
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={rootClass} style={rootStyle}>
        {body}
      </a>
    );
  }

  return (
    <div className={rootClass} style={rootStyle}>
      {body}
    </div>
  );
}

/* ── Grille ─────────────────────────────────────────────────────────────── */

/** 4 = la classe EXACTE d'avant P3-2 (défaut). */
const GRID_COLUMNS = {
  2: "grid gap-4 sm:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function KpiGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  // Injection de `index` — CIBLÉE sur les enfants qui sont réellement des
  // <Kpi>. C'est la condition de la rétrocompatibilité : les 13 vues du repo
  // enveloppent toutes leur <Kpi> dans un <Panel> ou une <Card>, donc rien ne
  // leur est injecté et leur DOM ne bouge pas d'un caractère. Injecter à
  // l'aveugle aurait posé un attribut `index="0"` sur ces <div>, c'est-à-dire
  // modifié le DOM de toutes les pages du produit.
  // Un `index` explicite passé par l'appelant l'emporte toujours.
  const staggered = Children.map(children, (child, i) => {
    if (!isValidElement(child) || child.type !== Kpi) return child;
    const el = child as React.ReactElement<KpiProps>;
    return el.props.index === undefined ? cloneElement(el, { index: i }) : el;
  });

  return (
    <div className={cn(GRID_COLUMNS[columns], className)}>{staggered}</div>
  );
}
