/**
 * Portfolio · Activity — FEUILLE BLANCHE (rebuild from scratch).
 *
 * 2026-06-27 : l'ancienne page (PortfolioLeafShell / TrustProofCompact /
 * ledger transactions groupé par date + portfolio.css + tokens --ct-*) a été
 * mise de côté pour repartir de zéro avec Catalyst, en miroir de la page
 * principale /portfolio. L'ancien code reste intact dans git et tous les
 * composants src/components/portfolio/* sont toujours là, simplement plus
 * rendus ici.
 *
 * Cette coquille n'importe NI portfolio.css NI les tokens --ct-* : base Catalyst
 * native (palette zinc, dark mode via .dark). Les surfaces sont reconstruites
 * une par une, validées au fur et à mesure.
 *
 * Le shell produit (rail gauche + chat) vient du layout parent
 * (src/app/(product)/layout.tsx) et reste en place — c'est l'infra d'auth/nav,
 * pas le DS de la page.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity",
  description: "Your full transaction history",
};


export default function ActivityPage() {
  return (
    <main
      data-portfolio-blank
      className="dark min-h-dvh bg-zinc-900 px-8 py-10 text-zinc-100"
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-white">Activity</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Feuille blanche — reconstruction en cours.
        </p>

        <div className="mt-10 rounded-xl border border-dashed border-white/10 p-16 text-center">
          <p className="text-sm text-zinc-500">
            Surfaces à reconstruire avec Catalyst, une par une.
          </p>
        </div>
      </div>
    </main>
  );
}
