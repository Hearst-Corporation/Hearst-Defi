# ANTI_HARDCODING_CHECKLIST.md — Outreach

> Batch 1/6 (architect, read-only). À appliquer par chaque batch 2-6 sur sa zone avant de
> considérer son audit terminé. Objectif : aucune valeur en dur non justifiée, aucune
> régression de comportement introduite par un test ajouté (un test ne doit jamais figer
> un hardcode en "spec" — s'il trouve un magic number suspect, il documente, il ne
> confirme pas silencieusement).

## A. Ce qui est un hardcode "en dur" légitime (constante de config documentée) — OK

Ces valeurs sont des constantes de module intentionnelles, pas des fuites de secret ou de
logique métier qui devrait être en base/env. Vérifier qu'elles restent **documentées** et
**testées** (valeur + raison), pas seulement présentes :

- `src/lib/outreach/send-policy.ts:126-127` — `WARMUP_FLOOR = 10`, `WARMUP_DAYS = 14`
  (courbe de warm-up envoi). Commentaire présent expliquant le doublement ; vérifier qu'un
  test couvre le comportement de bord (`dayIndex >= WARMUP_DAYS` → cap plein).
- `src/lib/agents/outreach-master-semantic.ts:24,27` — `SEMANTIC_THRESHOLD = 0.85`,
  `HF_TIMEOUT_MS = 4000` — seuils de fallback semantic. **Non testés du tout** (voir
  `COVERAGE_MATRIX.md` zone 3) : un batch doit au moins vérifier qu'un score juste sous/au
  seuil bascule bien en `unknown`/`no_action` comme documenté.
- `src/lib/outreach/env.ts` (via `src/lib/env.ts`) — `tierAMin/tierBMin/tierCMin` défauts
  85/60/40 sur `OutreachICP` (Prisma `@default`) — légitime (seuils produit actés avec
  Adrien dans `docs/plan/outreach-engine.md`), mais **doublement défini** : une fois en
  défaut Prisma, une fois potentiellement recopié en dur dans un mock de test. Vérifier
  qu'aucun test ne réécrit `85`/`60`/`40` en dur sans passer par le schéma/l'ICP réel —
  sinon un changement de seuil produit ne casserait pas les tests qui devraient le
  détecter (test qui ment).

## B. Points à vérifier explicitement (candidats hardcode réel ou config non gouvernée)

- **`OUTREACH_MASTER_MODE`** (`outreach-master-semantic.ts` — vérifier aussi
  `outreach-master-agent.ts`) est lu directement via `process.env.OUTREACH_MASTER_MODE`
  **sans passer par `src/lib/env.ts`** (le schéma Zod de validation au boot). C'est une
  incohérence avec la convention du repo ("Env vars validated by Zod at boot").
  Conséquence : une valeur invalide de cette env var ne fait pas échouer le boot, elle
  tombe silencieusement sur le comportement du `||` (`"semantic_fallback"` par défaut) à
  l'exécution. **À signaler** — pas forcément à corriger dans cette série (audit, pas
  fix), mais à faire remonter dans `DECISIONS.md` du batch qui traite la zone 3.
- **Rejets non persistés** (`icp.ts`) — voir `INVENTORY.md` §2. Ce n'est pas un hardcode,
  mais vérifier qu'aucun test ne "hardcode" une hypothèse sur le contenu d'un rejet
  individuel (puisque la donnée n'existe pas en base) — seuls les agrégats
  (`rejectedUnverified`, `rejectedTier`) sont des sources de vérité valables.
- **Mock data de test dupliqué, pas de factory partagée** — aucun répertoire de fixtures
  outreach centralisé trouvé (`__tests__` inline chacun leurs mocks Apollo/prospect). Ce
  n'est pas un hardcode business, mais un risque de dérive : si le format d'un objet
  Apollo mocké diverge entre `icp.test.ts` et `run-sourcing.test.ts`, les deux tests
  peuvent devenir vrais séparément tout en ne couvrant pas le même contrat réel. Un batch
  qui ajoute des tests dans une zone doit vérifier que son mock reproduit fidèlement le
  type réel (`ApolloPerson`/`ApolloEnrichResult` de `src/lib/apollo/client.ts`), pas une
  forme simplifiée qui masquerait un vrai bug de mapping.
- **Provenance forcée "manual" dans `outreach-kpi-strip.ts`** — vérifier que ce n'est pas
  un hardcode de complaisance mais reflète bien la réalité (les données outreach ne sont
  ni Live/Oracle/Attested — cf. non-négociable #2 du CLAUDE.md racine, "Every metric has a
  provenance badge"). Si un futur call Apollo réel ou webhook Resend devient la source, ce
  badge doit évoluer — documenter la dépendance (ne pas juste tester la valeur actuelle
  comme un invariant figé).
- **Warm-up / quota** (`OUTREACH_DAILY_SEND_CAP` défaut 30) — vérifier qu'aucun test dans
  `outreach-auto-send.test.ts` / `outreach-send.test.ts` ne recopie `30` en dur sans le
  faire dériver de l'env mocké (sinon un changement de défaut casse silencieusement moins
  de tests qu'il ne devrait).

## C. Garde-fous de non-régression à vérifier par chaque batch (pas seulement zone 1)

- **Mots interdits** (non-négociable #5) : tout email généré par `outreach-writer*` /
  toute réponse chat mentionnant l'outreach doit rester couvert par
  `assertNoForbiddenWords` — vérifier qu'aucun test n'a été écrit en désactivant ou en
  mockant ce guard pour "faire passer" un test (grep `assertNoForbiddenWords` dans les
  mocks du batch avant de clore la zone).
- **APY en range** : si un email/canvas outreach affiche un APY vault, vérifier qu'il ne
  hardcode jamais un point unique (`"11%"`) même dans un test — le format range
  (`"9.4-12.8%"`) doit être respecté jusque dans les fixtures de test.
- **Invariant `sendAllowed`/`requiresUserReview` du Master Agent** (zone 3) : ne doit
  **jamais** apparaître comme paramétrable/mockable à `true`/`false` dans un test sans que
  le test échoue explicitement si on essaie — un test qui accepterait silencieusement un
  override serait lui-même une régression de sécurité.
- **Pas d'envoi réel pendant l'audit** (`docs/EMAIL_CONTEXT.md`) : tout nouveau test ajouté
  par les batchs 2-6 doit mocker Resend/Apollo — jamais de vrai `fetch` sortant. Vérifier
  `vi.mock` présent sur `email/send.ts` et `apollo/client.ts` dans tout nouveau test qui
  touche à l'envoi ou au sourcing.

## D. Ce qui n'est PAS dans le périmètre de cette checklist

- Pas de scan générique anti-`any`/`as unknown as` (déjà couvert par `pnpm typecheck` en
  mode strict + skill `audit-code`) — cette checklist est spécifique aux valeurs métier en
  dur du domaine Outreach, pas à la qualité TS générale.
- Pas d'audit de sécurité des routes (`skill audit-security` couvre déjà env vars/CSP/
  injections de façon transverse) — sauf le point `OUTREACH_MASTER_MODE` ci-dessus qui est
  spécifique à ce module.
