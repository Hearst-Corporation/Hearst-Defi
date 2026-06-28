/**
 * Portfolio — détail position /portfolio/[positionId] — FEUILLE BLANCHE (rebuild from scratch).
 *
 * 2026-06-27 : l'ancienne page (PositionHeader / PositionKpis / PositionActions /
 * PositionTransactions / Card + loadPosition + portfolio.css + tokens --ct-*) a été
 * mise de côté pour repartir de zéro avec Catalyst, comme la page principale
 * /portfolio. L'ancien code reste intact dans git
 * (`git show HEAD:"src/app/(product)/portfolio/[positionId]/page.tsx"`) et tous les
 * composants src/components/portfolio/* sont toujours là, simplement plus rendus ici.
 *
 * Cette coquille n'importe NI portfolio.css NI les tokens --ct-* et ne charge AUCUNE
 * donnée (pas de loadPosition) : base Catalyst native (palette zinc, dark mode via
 * .dark). Les surfaces sont reconstruites une par une, validées au fur et à mesure.
 *
 * Route DYNAMIQUE : on garde une signature Next.js 16 valide (`params` async).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ positionId: string }>;
}

export const metadata = {
  title: "Position",
};


export default async function PositionDetailPage({ params }: PageProps) {
  const { positionId } = await params;

  return (
    <main
      className="dark min-h-dvh bg-surface-page px-8 py-10 text-zinc-100"
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-white">Position</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Feuille blanche — reconstruction en cours.
        </p>

        <div className="mt-10 rounded-xl border border-dashed border-white/10 p-16 text-center">
          <p className="text-sm text-zinc-500">
            Détail position{" "}
            <span className="font-mono text-zinc-400">{positionId}</span> — surface à
            reconstruire avec Catalyst.
          </p>
        </div>
      </div>
    </main>
  );
}
