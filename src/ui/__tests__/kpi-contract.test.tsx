import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  KPI_UNAVAILABLE_FALLBACK,
  Kpi,
  KpiGrid,
  __sparkPathForTest,
} from "@/ui/kpi";

/**
 * Contrat de la tuile KPI (mission P3-2).
 *
 * La raison d'être de ce fichier est la RÉTROCOMPATIBILITÉ. `src/ui/kpi.tsx`
 * est rendu par 13 vues (7 admin, 5 investor, 1 dashboard) qui n'ont pas été
 * touchées. Les chaînes `GOLDEN_*` ci-dessous ont été capturées sur le
 * composant AVANT l'enrichissement (HEAD 912ba84c) : si l'une d'elles bouge,
 * c'est que 13 pages du produit ont changé de DOM sans que personne l'ait
 * demandé.
 */

const ROOT = process.cwd();
const SRC = readFileSync(join(ROOT, "src/ui/kpi.tsx"), "utf8");

/**
 * Les interdits portent sur le CODE ÉMIS, pas sur la prose : le commentaire qui
 * explique pourquoi Recharts, `will-change` ou un compteur animé sont écartés
 * doit pouvoir les nommer. Un gardien qui interdit d'expliquer la décision
 * qu'il protège se retourne contre elle.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const CODE = stripComments(SRC);

// ── Empreintes capturées sur le composant d'avant P3-2 ───────────────────────
const GOLDEN_MINIMAL =
  '<div class="flex flex-col gap-1">' +
  '<div class="flex items-center gap-2"><span class="hc-metric-label">L</span></div>' +
  '<div class="flex items-baseline gap-2"><span class="hc-metric-value">V</span></div>' +
  "</div>";

const GOLDEN_FULL =
  '<div class="flex flex-col gap-1">' +
  '<div class="flex items-center gap-2"><span class="hc-metric-label">Total value locked</span>' +
  '<span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-accent-muted text-accent-ink">Live</span></div>' +
  '<div class="flex items-baseline gap-2"><span class="hc-metric-value">$1,234</span>' +
  '<span class="text-xs font-medium tabular-nums text-accent-ink">+2.4%</span></div>' +
  '<p class="text-xs text-subtle">On-chain vault assets</p>' +
  "</div>";

const GOLDEN_NEGATIVE_DELTA =
  '<div class="flex flex-col gap-1 extra">' +
  '<div class="flex items-center gap-2"><span class="hc-metric-label">L</span></div>' +
  '<div class="flex items-baseline gap-2"><span class="hc-metric-value">V</span>' +
  '<span class="text-xs font-medium tabular-nums text-muted">-1%</span></div>' +
  "</div>";

/** La classe de grille d'avant P3-2, au caractère près. */
const GOLDEN_GRID_CLASS = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

describe("rétrocompatibilité — les props d'origine rendent le DOM d'avant", () => {
  it("label + value seuls", () => {
    expect(renderToStaticMarkup(<Kpi label="L" value="V" />)).toBe(
      GOLDEN_MINIMAL,
    );
  });

  it("delta positif + provenance + hint", () => {
    expect(
      renderToStaticMarkup(
        <Kpi
          label="Total value locked"
          value="$1,234"
          delta={{ value: "+2.4%", positive: true }}
          provenance="live"
          hint="On-chain vault assets"
        />,
      ),
    ).toBe(GOLDEN_FULL);
  });

  it("delta sans `positive` reste gris, className est concaténé comme avant", () => {
    expect(
      renderToStaticMarkup(
        <Kpi label="L" value="V" delta={{ value: "-1%" }} className="extra" />,
      ),
    ).toBe(GOLDEN_NEGATIVE_DELTA);
  });

  it("aucune prop nouvelle n'est requise (le type compile sans elles)", () => {
    // Compile-time autant que runtime : si une prop devenait obligatoire, les
    // 13 appelants ne compileraient plus.
    expect(() => renderToStaticMarkup(<Kpi label="L" value="V" />)).not.toThrow();
  });

  it("state=\"ready\" explicite est identique au défaut", () => {
    expect(renderToStaticMarkup(<Kpi label="L" value="V" state="ready" />)).toBe(
      GOLDEN_MINIMAL,
    );
  });
});

describe("KpiGrid — la grille par défaut n'a pas bougé", () => {
  it("columns par défaut = la classe exacte d'avant", () => {
    const html = renderToStaticMarkup(
      <KpiGrid>
        <div className="panel" />
      </KpiGrid>,
    );
    expect(html).toBe(`<div class="${GOLDEN_GRID_CLASS}"><div class="panel"></div></div>`);
  });

  it("columns=4 explicite est identique au défaut", () => {
    expect(
      renderToStaticMarkup(
        <KpiGrid columns={4}>
          <div className="panel" />
        </KpiGrid>,
      ),
    ).toContain(`class="${GOLDEN_GRID_CLASS}"`);
  });

  it("columns 2 et 3 changent la grille sans toucher au gap", () => {
    expect(
      renderToStaticMarkup(
        <KpiGrid columns={2}>
          <div />
        </KpiGrid>,
      ),
    ).toContain('class="grid gap-4 sm:grid-cols-2"');
    expect(
      renderToStaticMarkup(
        <KpiGrid columns={3}>
          <div />
        </KpiGrid>,
      ),
    ).toContain('class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"');
  });

  it("LE POINT CRITIQUE : un enfant qui n'est pas un <Kpi> ne reçoit RIEN", () => {
    // C'est exactement la forme des 13 vues du repo : <Kpi> est toujours
    // enveloppé dans un <Panel> ou une <Card>. Une injection à l'aveugle aurait
    // posé un attribut `index="0"` sur ces wrappers — donc modifié le DOM de
    // toutes les pages qui affichent des KPI.
    const html = renderToStaticMarkup(
      <KpiGrid>
        <div className="panel">
          <Kpi label="A" value="1" />
        </div>
      </KpiGrid>,
    );
    expect(html).not.toContain("index");
    expect(html).not.toContain("animate-rise");
    expect(html).toContain(GOLDEN_MINIMAL.replace(">L<", ">A<").replace(">V<", ">1<"));
  });

  it("un <Kpi> enfant DIRECT reçoit son rang (décalage d'entrée)", () => {
    const html = renderToStaticMarkup(
      <KpiGrid>
        <Kpi label="A" value="1" />
        <Kpi label="B" value="2" />
      </KpiGrid>,
    );
    expect(html).toContain("animate-rise");
    expect(html).toContain("animation-delay:0ms");
    expect(html).toContain("animation-delay:40ms");
  });

  it("le décalage plafonne au 4ᵉ rang (au-delà ça se lit comme de la lenteur)", () => {
    const html = renderToStaticMarkup(
      <KpiGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <Kpi key={i} label={`K${i}`} value={String(i)} />
        ))}
      </KpiGrid>,
    );
    expect(html).toContain("animation-delay:120ms");
    expect(html).not.toContain("animation-delay:160ms");
    expect(html).not.toContain("animation-delay:200ms");
  });

  it("un index explicite l'emporte sur l'injection", () => {
    const html = renderToStaticMarkup(
      <KpiGrid>
        <Kpi label="A" value="1" index={3} />
      </KpiGrid>,
    );
    expect(html).toContain("animation-delay:120ms");
  });

  it("sans grille, un <Kpi> seul n'a AUCUNE animation d'entrée", () => {
    expect(renderToStaticMarkup(<Kpi label="L" value="V" />)).not.toContain(
      "animate-rise",
    );
  });
});

describe("state=\"unavailable\" — le motif, jamais un zéro ni un tiret muet", () => {
  const html = renderToStaticMarkup(
    <Kpi label="Hashrate" value="ignored" state="unavailable" unavailableReason="RPC unreachable" />,
  );

  it("affiche le motif fourni", () => {
    expect(html).toContain("RPC unreachable");
  });

  it("ne rend jamais la valeur qu'on lui a passée", () => {
    expect(html).not.toContain("ignored");
    expect(html).not.toContain("hc-metric-value");
  });

  it("ne rend ni 0, ni $0, ni un tiret seul", () => {
    // Le texte visible, débarrassé des balises.
    const text = html.replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/(^|\s)\$?0([.,]0+)?(\s|$)/);
    expect(text).not.toMatch(/(^|\s)[—–-](\s|$)/);
  });

  it("porte la provenance `stale` — pas celle que l'appelant croyait avoir", () => {
    const withLive = renderToStaticMarkup(
      <Kpi label="X" value="1" provenance="live" state="unavailable" unavailableReason="no feed" />,
    );
    expect(withLive).toContain(">Stale<");
    expect(withLive).not.toContain(">Live<");
  });

  it("sans motif, dit que le motif manque — il n'en invente pas", () => {
    const bare = renderToStaticMarkup(
      <Kpi label="X" value="1" state="unavailable" />,
    );
    expect(bare).toContain(KPI_UNAVAILABLE_FALLBACK);
    expect(KPI_UNAVAILABLE_FALLBACK).not.toMatch(/^[—–-]$/);
  });

  it("occupe la hauteur d'une valeur — la rangée ne se déforme pas", () => {
    expect(html).toContain("min-h-8");
  });
});

describe("state=\"loading\" — géométrie identique à l'état chargé", () => {
  it("reprend les hauteurs de ligne exactes (label 1rem, valeur 2rem)", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" state="loading" />);
    // h-4 = 1rem  = line-height de .hc-metric-label (text-2xs)
    // h-8 = 2rem  = line-height de .hc-metric-value (text-2xl)
    expect(html).toContain("h-4 ");
    expect(html).toContain("h-8 ");
    expect(html).toContain('class="flex flex-col gap-1"');
  });

  it("n'ajoute la ligne hint QUE si la tuile chargée en aurait une", () => {
    const sans = renderToStaticMarkup(<Kpi label="L" value="V" state="loading" />);
    const avec = renderToStaticMarkup(
      <Kpi label="L" value="V" hint="h" state="loading" />,
    );
    // h-4.5 = 1.125rem = line-height de text-xs (le hint)
    expect(sans).not.toContain("h-4.5");
    expect(avec).toContain("h-4.5");
  });

  it("n'affiche AUCUN chiffre pendant le chargement", () => {
    const html = renderToStaticMarkup(
      <Kpi label="TVL" value="$1,234" delta={{ value: "+2%" }} state="loading" />,
    );
    expect(html).not.toContain("1,234");
    expect(html).not.toContain("+2%");
  });

  it("s'annonce comme occupé et dit CE QUI charge", () => {
    const html = renderToStaticMarkup(<Kpi label="TVL" value="x" state="loading" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("TVL — loading");
  });

  it("un lien ne devient pas cliquable tant qu'il charge", () => {
    const html = renderToStaticMarkup(
      <Kpi label="L" value="V" href="/x" state="loading" />,
    );
    expect(html).not.toContain("<a ");
  });
});

describe("sparkline — SVG pur, honnête, et muet pour l'AT", () => {
  it("0 ou 1 point ne rend AUCUN <path> (un point n'est pas une tendance)", () => {
    expect(renderToStaticMarkup(<Kpi label="L" value="V" spark={[]} />)).not.toContain(
      "<path",
    );
    expect(renderToStaticMarkup(<Kpi label="L" value="V" spark={[]} />)).not.toContain(
      "<svg",
    );
    expect(renderToStaticMarkup(<Kpi label="L" value="V" spark={[42]} />)).not.toContain(
      "<path",
    );
    expect(__sparkPathForTest([])).toBeNull();
    expect(__sparkPathForTest([42])).toBeNull();
  });

  it("2 points et plus rendent un tracé", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" spark={[1, 2, 3]} />);
    expect(html).toContain("<svg");
    expect(html).toContain("<path");
  });

  it("une série trouée (NaN/Infinity) ne dessine rien plutôt qu'un zéro", () => {
    expect(__sparkPathForTest([1, Number.NaN, 3])).toBeNull();
    expect(__sparkPathForTest([1, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("est aria-hidden — redondant avec la valeur et le delta, déjà lus", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" spark={[1, 2, 3]} />);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("assume preserveAspectRatio=none, et compense sur l'épaisseur du trait", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" spark={[1, 2]} />);
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
  });

  it("n'utilise pas Recharts (la tuile doit rester un Server Component)", () => {
    expect(CODE).not.toMatch(/recharts/i);
    expect(CODE).not.toMatch(/^\s*["']use client["']/m);
  });

  /**
   * LE test du lissage : une Bézier de Catmull-Rom non bornée invente un
   * sommet au-dessus de la plus haute valeur mesurée. On échantillonne le
   * tracé et on vérifie qu'il ne sort jamais de la bande définie par les
   * extrêmes réels.
   */
  it("ne dépasse JAMAIS les points (pas de pic inventé)", () => {
    const SPARK_H = 20;
    const PAD = 1;
    // Série en marche d'escalier : le cas qui fait déborder le Catmull-Rom nu,
    // sur le segment qui suit le plateau.
    for (const series of [
      [0, 0, 1, 1],
      [1, 1, 0, 0],
      [0, 10, 10, 0],
      [5, 1, 9, 2, 8, 3],
      [3, 3, 3, 3],
    ]) {
      const d = __sparkPathForTest(series);
      expect(d, `série ${series.join(",")}`).not.toBeNull();
      const ys = sampleCurveY(d as string);
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      // Tolérance de 1e-6 : arrondi à 2 décimales du path, rien de plus.
      expect(lo, `série ${series.join(",")} — dépasse par le haut`).toBeGreaterThanOrEqual(
        PAD - 1e-6,
      );
      expect(hi, `série ${series.join(",")} — dépasse par le bas`).toBeLessThanOrEqual(
        SPARK_H - PAD + 1e-6,
      );
    }
  });
});

/** Échantillonne les ordonnées d'un path `M … C …` (100 points par segment). */
function sampleCurveY(d: string): number[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const ys: number[] = [];
  let px = nums[0] ?? 0;
  let py = nums[1] ?? 0;
  ys.push(py);
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const c1y = nums[i + 1] ?? 0;
    const c2y = nums[i + 3] ?? 0;
    const y = nums[i + 5] ?? 0;
    for (let s = 1; s <= 100; s++) {
      const t = s / 100;
      const u = 1 - t;
      ys.push(u * u * u * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
    }
    px = nums[i + 4] ?? px;
    py = y;
  }
  void px;
  return ys;
}

describe("trend — la direction neutre que le booléen ne savait pas dire", () => {
  it("`flat` est neutre (gris), et n'est pas exprimable via delta.positive", () => {
    const html = renderToStaticMarkup(
      <Kpi label="L" value="V" trend="flat" delta={{ value: "0.0%" }} />,
    );
    expect(html).toContain("text-muted");
    expect(html).not.toContain("text-accent-ink");
  });

  it("`trend` l'emporte sur `delta.positive`", () => {
    const down = renderToStaticMarkup(
      <Kpi label="L" value="V" trend="down" delta={{ value: "+1%", positive: true }} />,
    );
    expect(down).toContain("text-muted");
    expect(down).not.toContain("text-accent-ink");

    const up = renderToStaticMarkup(
      <Kpi label="L" value="V" trend="up" delta={{ value: "-1%", positive: false }} />,
    );
    expect(up).toContain("text-accent-ink");
  });

  it("aucune baisse n'est rouge (un seul vert, zéro rouge)", () => {
    for (const t of ["up", "down", "flat"] as const) {
      const html = renderToStaticMarkup(<Kpi label="L" value="V" trend={t} />);
      expect(html).not.toContain("text-danger");
      expect(html).not.toContain("text-red");
    }
  });

  it("la direction n'est pas portée par la seule couleur (glyphe + doublure AT)", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" trend="down" />);
    expect(html).toContain("↓");
    expect(html).toContain("sr-only");
    expect(html).toContain("down");
  });
});

describe("href — drill-down", () => {
  it("rend un <a> et une affordance visible", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" href="/portfolio" />);
    expect(html).toContain('<a href="/portfolio"');
    expect(html).toContain("<svg"); // le chevron
  });

  it("le survol n'anime que border-color et transform, l'ombre voyage en opacité", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" href="/x" />);
    expect(html).toContain("transition-[border-color,transform]");
    expect(html).toContain("hover:-translate-y-px");
    expect(html).toContain("after:opacity-0");
    expect(html).toContain("hover:after:opacity-100");
    // L'ombre est POSÉE sur le ::after, jamais animée en box-shadow.
    expect(html).not.toContain("transition-shadow");
    expect(html).not.toContain("transition-[box-shadow");
  });

  it("sans href, aucune affordance ni transition de survol", () => {
    const html = renderToStaticMarkup(<Kpi label="L" value="V" />);
    expect(html).not.toContain("hover:");
    expect(html).not.toContain("after:");
  });
});

describe("décisions de doctrine verrouillées dans la source", () => {
  it("AUCUN compteur animé — on n'affiche pas de chiffres faux pendant 400 ms", () => {
    // Un compteur animé a besoin d'une boucle et d'un état. Ni l'un ni l'autre
    // n'existent ici, et la tuile n'est même pas un Client Component.
    expect(CODE).not.toMatch(/requestAnimationFrame/);
    expect(CODE).not.toMatch(/setInterval/);
    expect(CODE).not.toMatch(/\buseState\b/);
    expect(CODE).not.toMatch(/\buseEffect\b/);
    // …et la décision est ÉCRITE, pas seulement subie : c'est la seule
    // assertion de ce fichier qui vise volontairement la prose.
    expect(SRC).toMatch(/PAS DE COMPTEUR ANIMÉ/);
  });

  it("PAS de will-change sur la tuile (4 couches promues pour 150 ms de survol)", () => {
    expect(CODE).not.toMatch(/willChange/);
    expect(CODE).not.toMatch(/will-change/);
  });

  it("aucune couleur en dur — que des rôles", () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/\bdark:/);
    expect(CODE).not.toMatch(/\btext-white\b|\btext-black\b|\btext-zinc-/);
  });

  it("motion : uniquement les tokens canon (un seul easing, durées tokenisées)", () => {
    const durations = CODE.match(/duration-\[?\d+/g) ?? [];
    expect(durations).toEqual([]);
    // Le décalage d'entrée est le seul temps littéral, et il est plafonné.
    expect(CODE).toMatch(/STAGGER_STEP_MS = 40/);
    expect(CODE).toMatch(/STAGGER_MAX_RANK = 3/);
  });
});
