# M12 — Intégration front / back (strangler par domaine)

**Owner** : backend + `ui-dev` · **Vague** : 2 (après M10/M11) · **Dépend de** : M10, M11 ·
**Périmètre** : proxy par domaine, flags, parité

## Objectif
Basculer les domaines Series 1 du chemin direct (Server Component → Prisma / engine) vers le
backend source-of-truth, **un domaine à la fois**, avec rollback en un flip de flag et parité
prouvée avant de couper le direct.

## Contexte
Migration **strangler** déjà spécifiée (`docs/gpu1-migration-status.md`) : "Nothing yet". Le nouveau
service se dresse **à côté** des loaders existants ; rien n'est arraché tant que son remplacement
backend n'est pas live et prouvé.

## Tâches
1. **Proxy par domaine** : pour chaque domaine Series 1 (dashboard, btc, vault state, mining, proof,
   Zandbank), router la lecture front vers le backend **derrière un flag** (env), le direct restant
   la valeur de repli.
2. **Parité avant coupure** : prouver que le DTO backend == le résultat direct (même chiffres,
   même provenance) sur un domaine avant de basculer le flag en défaut backend. Screenshots Adrien +
   comparaison de valeurs.
3. **Rollback** : un flip d'env ramène au direct. Documenter la procédure.
4. **Ordre de bascule** : dashboard d'abord (déjà premier candidat strangler), puis btc / vault
   state, puis proof, puis Zandbank.
5. **Ne couper le direct** qu'après parité prouvée + fenêtre de stabilité — pas dans le même diff que
   la bascule.

## Invariants
- **Rien n'est arraché avant que le remplacement backend soit live et prouvé.**
- **Pas de push main direct** (deploy prod) sans confirmation ; **pas de DB write prod** ; le flag de
  bascule ne doit jamais exposer un état incohérent.
- Honnêteté des états pendant la transition (pas de faux Live sur un domaine à moitié basculé).

## Gate
`pnpm typecheck && pnpm test`. Parité DTO vs direct documentée par domaine. Vérif browser : Adrien
confirme parité visuelle avant coupure.

## Définition de fini
Chaque domaine Series 1 basculé derrière flag avec parité prouvée + rollback documenté ; direct
conservé jusqu'à stabilité ; aucune coupure sans preuve.
