# Méthode de reconstruction du Portfolio

Comment on travaille sur cette page (et le standard pour la suite) :

- **Tailwind d'abord** — tout le layout/style en classes Tailwind dans le JSX. Pas de `portfolio.css`, pas de `.pf-*`, pas de l'ancien système. La feuille blanche reste blanche.
- **Catalyst pour les composants** — `Button`, `Badge`, `Table`, `Heading`, `Text`… viennent de `src/components/catalyst/*`, consommés tel quel (conventions natives : `color="green"` pour l'accent, palette zinc, dark mode).
- **Respect des tokens** — un seul vert accent `#A7FB90` (= `--ct-accent`), pas d'autre couleur inventée, dark mode only. Si un token DS existe pour une valeur, on l'utilise plutôt qu'un hex en dur.
- **On ne touche pas au shell** — rail / chat / header / footer / barre menu viennent du CockpitShell. On calibre dans la zone centrale, on ne réécrit pas le shell pour un ajustement de page.
- **Une modif à la fois, validée** — chaque changement isolé et confirmé, pas d'amélioration non demandée, pas de refactor caché.
- **Pas de commit/push sans demande, réversibilité totale.**