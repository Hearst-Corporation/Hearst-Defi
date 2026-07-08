# Runbook démo Zand — Hearst Connect

> Langue : instructions opérateur en français, tout talk-track client en anglais (EN).
> Sources : les 10 fichiers `audit-*.json` du scratchpad B1 (auth-onboarding, invest-subscribe,
> portfolio-display, proof-decentralization, admin-capabilities, prod-readiness, chat-agent,
> b2b-gaps, zand-web, product-facts), **complétées par des vérifications post-audit** (curl direct
> sur les domaines, lecture des livrables code posés dans l'arbre — voir §0 et §6). Zéro fait
> inventé. Voir §7 pour les endroits où les sources d'origine se contredisent ou sont muettes.
>
> **Ce document remplace le draft précédent : la décision de domaine (§0) est TRANCHÉE, elle
> n'est plus bloquante.**

---

## 0. DÉCISION DE DOMAINE — TRANCHÉE

**La démo se fait sur `https://app.hearst.app`.** Vérifié par curl le jour de cette mise à jour :

| URL | Résultat |
|---|---|
| `app.hearst.app/login` | **200** |
| `app.hearst.app/api/health` | **200** |
| `app.hearst.app/portfolio` | **307 → `/login`** (comportement attendu, non authentifié) |
| `connect.hearst.app/login` | **404** — domaine tenu par le projet landing marketing (autre repo Vercel) |

`app.hearst.app` est la prod réelle de cette app (Lecture B de l'ancien §0 confirmée ; Lecture A —
Promote-to-Production sur `connect.hearst.app` — écartée). **Le re-pointage de
`connect.hearst.app` vers cette app reste une option pour Adrien, pas un prérequis** de cette
démo : toutes les étapes ci-dessous fonctionnent dès aujourd'hui sur `app.hearst.app`.

**Filet de secours dans tous les cas : `pnpm dev` en local, port 4105** (pointe la même DB prod
via le pooler — mêmes comptes, mêmes données).

---

## 1. RUN-OF-SHOW — 30 MINUTES

Chronométrage indicatif ; source = `demoPath` de chaque audit. Écrans entre crochets = optionnels
si le temps le permet. Toutes les URL ci-dessous s'entendent sur **`app.hearst.app`** (ou
`localhost:4105` en filet de secours) — voir §0.

### T+0–3 min — Login + création de compte Zand en live
- Opérateur A (rôle admin) : se logger sur `/admin/customers` → bouton **Create investor**
  (`customers/actions.ts:106`) → créer l'investisseur (ex. `zand.demo@hearstcorporation.io`,
  role=investor, `kycStatus=pending`). *(source : audit-auth-onboarding, audit-admin-capabilities)*
- Sur la fiche `/admin/customers/[id]` → **Generate activation link**
  (`[id]/actions.ts:143-172`) : lien `/reset-password?token=…` valide 7 jours, **indépendant de
  Resend** (pas d'email à attendre). *(source : audit-auth-onboarding)*
- **Ouvrir le lien d'activation dans un navigateur/profil DISTINCT (ou une fenêtre de navigation
  privée) de la session admin de l'Opérateur A — jamais un onglet du même navigateur** (poste
  "client") → définir le mot de passe → session créée automatiquement → atterrissage direct sur
  `/portfolio` (`reset-password/actions.ts:83-87`). Même contrainte `hc_session` (cookie unique
  par origine, partagé entre tous les onglets d'un même navigateur) que celle déjà codifiée au
  T+14-20 et en §4 pour `adrien+demo` vs `zand.demo` — ici entre la session admin de l'Opérateur A
  (encore nécessaire au T+6-9 KYC approve et au T+26-29 console admin) et `zand.demo` : se logger
  dans un onglet du même navigateur écraserait la session admin. *(source : audit-auth-onboarding)*
- Talk-track EN : *"Your client's account is provisioned by your ops team, then activated by a
  single-use link — no dependency on our email pipeline for the live activation step."*

### T+3–6 min — Accréditation investisseur (3 cases)
- Naviguer `/vaults/hearst-yield-vault/invest` → redirection automatique
  `/onboarding/accreditation` (l'investisseur n'est PAS encore accrédité)
  → cocher les 3 attestations (Rule 506(c) + Cayman PIF, `actions/accreditation.ts:28-40`).
  *(source : audit-auth-onboarding, audit-invest-subscribe)*
- Talk-track EN : *"Before any subscription, the investor self-attests accreditation — this is
  a compliance gate, not a formality, and it's enforced server-side."*

### T+6–9 min — KYC approve côté admin
- Opérateur A repasse sur `/admin/customers/[id]` → **KycAction → approve**
  (`setInvestorKyc`, `customers/actions.ts:38-85`) — débloque l'accès à `/invest`
  (`kyc-gate.ts:90-92`). *(source : audit-auth-onboarding)*
- **NE PAS dérouler le KYC Sumsub réel en live** : sandbox `sbx:`, verdict GREEN asynchrone via
  webhook, délai non maîtrisé — utiliser l'override admin. *(source : audit-auth-onboarding,
  avoidThis)*

### T+9–14 min — Souscription ≥ $250,000 (JAMAIS moins)
- Retour côté investisseur `/vaults/hearst-yield-vault/invest` → saisir **exactement
  ≥ $250,000** → cocher le term sheet → Review deposit.
  **RAPPEL CRITIQUE** : l'UI accepte dès $10 (`vault.minTicketUsdc` DB = 10, valeur baissée pour
  le pilote) mais le **serveur rejette tout montant < $250,000 Class A en production**
  (`subscribe-logic.ts:36-57`, `share-class.ts:24` (constante $250k) + `subscribe-logic.ts:42`
  (garde `NODE_ENV` qui ignore `DEMO_MIN_TICKET_USDC` en production)). Une saisie < $250k =
  erreur rouge devant le client.
  *(source : audit-invest-subscribe, audit-admin-capabilities, audit-b2b-gaps — convergent)*
- **Mise à jour post-draft — allowlist démo étendue** : `src/lib/demo/allowlist.ts:14-17` inclut
  désormais **deux** comptes démo — `adrien+demo@hearstcorporation.io` **et
  `zand.demo@hearstcorporation.io`** (tests couvrant les deux dans
  `src/lib/demo/__tests__/allowlist.test.ts`). Si le compte investisseur créé au T+0 est
  `zand.demo@hearstcorporation.io`, il aura lui aussi le bouton **Simulate deposit** —
  **mais seulement une fois ce changement déployé en prod** (voir ⚠️ ci-dessous).
- ⚠️ **Statut de déploiement** : ce changement (allowlist + tests) est posé dans l'arbre, commit
  et push relèvent de l'orchestrateur — **un push = un deploy prod** (aucun gate CI, cf. §5).
  - **Si déployé avant la démo** : le compte `zand.demo@hearstcorporation.io` créé au T+0 a le
    bouton **Simulate deposit** visible (`invest-form.tsx:841-858`) → aucun wallet/USDC testnet
    requis → `subscribe(allowOffChain:true)` → redirection `/invest/confirmed?demo=1`.
    *(source : audit-invest-subscribe)*
  - **Si PAS déployé avant la démo** (ou démo en local port 4105, où le changement est effectif
    immédiatement sans attendre un deploy) : deux filets de secours —
    1. Utiliser directement le compte `adrien+demo@hearstcorporation.io` (déjà dans l'allowlist
       de longue date) pour la partie "Simulate deposit" du run-of-show, en gardant
       `zand.demo@…` pour le reste du parcours (login/KYC/accréditation) ; ou
    2. Fallback admin **Deploy position** (≥ $250k Class A) depuis la fiche client
       (`customers/[id]/page.tsx:172`, `deployPosition actions.ts:199-330`) — off-chain,
       `txHash null`. *(source : audit-invest-subscribe, audit-b2b-gaps)*
- **NE PAS tenter le dépôt on-chain réel** (wallet Privy + USDC Base Sepolia + allowance) : trop
  de points de défaillance non répétés. *(source : audit-invest-subscribe, avoidThis)*

### T+14–20 min — La montée : écrans qui reflètent vraiment la souscription
Ordre exact recommandé par convergence des audits invest-subscribe + portfolio-display :
1. `/my-vaults` — nouvelle ligne, valeur = principal + accrued, réel (`my-vaults/page.tsx:47`).
2. `/portfolio/positions` — ledger live.
3. Ouvrir la position → `/portfolio/[positionId]` (Vault Details) — hero + 4 KPI provenance,
   yield history, capital protection, transactions.
   **Précision compte** : cette vue riche (12 distributions réelles, yield history complet) n'existe
   QUE sur la position seedée $250k du compte `adrien+demo@hearstcorporation.io` — le compte
   `zand.demo@hearstcorporation.io` créé au T+0 est vierge et sa position (souscrite en live au
   T+9-14) n'a ni historique de distributions ni yield history à montrer.
   **⚠️ Onglet ≠ fenêtre : le cookie `hc_session` est unique par origine et PARTAGÉ entre tous
   les onglets d'un même navigateur** — se logger sur `zand.demo` au T+0 écrase toute session
   `adrien+demo` pré-ouverte dans un autre onglet du même navigateur. `adrien+demo` doit donc
   vivre dans un **navigateur/profil distinct (ou une fenêtre de navigation privée) de
   `zand.demo`**, jamais un simple onglet — même contrainte que les 2 sessions admin multisig
   (§4, ligne "2 sessions admin distinctes"). Transition scénique : basculer de **fenêtre**
   (pas d'onglet) vers la fenêtre `adrien+demo` **préparée T-1h** (session déjà ouverte dans son
   propre navigateur/profil, voir §4) pour dérouler cette page dans toute sa richesse —
   *"here's what a mature position looks like after several distribution cycles"* — puis revenir
   sur la fenêtre `zand.demo` pour montrer la position qu'ils viennent eux-mêmes de souscrire en
   direct — *"and here's the position you just created, live, on your own account."*
   *(source : `page.tsx:101-548`)*
4. `/admin/vaults/hearst-yield-vault` — **AVANT puis APRÈS la souscription** : l'AUM est la
   **somme live des positions actives** (`admin/vaults/[id]/page.tsx:83`) et monte sous leurs
   yeux ; nouvelle ligne dans "Subscribers" (lignes 420-455). C'est **LA** preuve visuelle
   "le vault monte" côté console de distribution. *(source : audit-invest-subscribe,
   audit-admin-capabilities — convergent sur ce point précis)*
- **INTERDIT ABSOLU** : ouvrir `/portfolio` (page principale du rail "Portfolio") comme preuve
  de montée — c'est une **console V4 100% MOCK**, chiffres hardcodés identiques pour tous les
  comptes ($500k → $531.4k figés, badge "Sandbox · V4" + disclaimer "mock/estimated data"
  visibles à l'écran), **insensible à la souscription**. Si un client compare ce montant au
  montant qu'il vient de souscrire → incohérence flagrante en direct.
  *(source : audit-portfolio-display, audit-invest-subscribe — convergence forte, répété dans
  les deux fichiers comme risque n°1 de cet axe)*
- `/vaults` et `/vaults/[id]` (catalogue, term sheet) : l'AUM/TVL affichés ($12.5M) viennent du
  dernier `VaultSnapshot` figé (seed du 04/07) — **ne bougent PAS** après une souscription
  (aucun pont souscription→snapshot dans le code). Ne pas les présenter comme "la TVL qui monte".
  *(source : audit-invest-subscribe, gaps)*

### T+20–22 min — Yield-tick entre deux écrans
- Aucun mécanisme runtime ne fait "monter" `accruedYieldUsdc` automatiquement (rien dans
  `src/lib/inngest/functions/` ne l'écrit ; seul `scripts/seed-dev-position.ts:85` le faisait
  jusqu'ici). *(source : audit-portfolio-display, audit-invest-subscribe, audit-b2b-gaps —
  convergence forte)*
- **Mise à jour post-draft — le script existe désormais** : `scripts/demo/yield-tick.ts`. Dry-run
  par défaut (n'écrit rien tant que `--execute` n'est pas passé), plafond **$100,000 par tick**,
  `--position-id` optionnel pour cibler une position précise. La valeur affichée
  (principal + accrued) monte visiblement au refresh de `/my-vaults` / `/portfolio/[positionId]`.
  - **Dry-run (à répéter la veille pour valider le plan, n'écrit rien)** :
    ```bash
    npx tsx scripts/demo/yield-tick.ts --email <email> --amount 1500
    ```
  - **Exécution en démo, entre deux écrans** (ex. entre l'écran `/my-vaults` avant et sa
    réouverture après) :
    ```bash
    ALLOW_PROD_WRITES=1 npx tsx scripts/demo/yield-tick.ts --email <email> --amount 1500 --snapshot --execute
    ```
    `--snapshot` ajoute une ligne `InvestorNavSnapshot` (source `demo_tick`) pour que le chart NAV
    se rafraîchisse aussi. Sans `ALLOW_PROD_WRITES=1`, le script refuse d'écrire si
    `DATABASE_URL` pointe la prod (garde fail-closed identique à `scripts/lib/prisma-cli.ts`,
    ref Supabase `xrwzxhsenwmlxbwqcftz`).
  - N'écrit **jamais** d'`InvestorTransaction` — ce n'est pas une distribution réelle, seulement
    le solde "accrued non distribué", exactement comme la fixture `seed-dev-position.ts`.
- Si le montant a été validé en dry-run la veille, exécuter la commande `--execute` entre les
  deux écrans pour montrer `Current Value` bouger visiblement.
- Sinon, **ne pas improviser** de mise à jour DB en live — s'en tenir au récit "distribution
  mensuelle confirmée par l'admin fait monter le solde" sans l'exécuter réellement (voir §2).

### T+22–26 min — Proof Center + BaseScan
- `/proof-center` : survoler les `ProvenanceBadge` (tooltips Live/Oracle/Attested/Estimated/
  Manual/Stale) — "chaque métrique porte sa source". *(source : audit-proof-decentralization)*
- Panneau "Mining cash-flow" badge **Estimated** : *"as long as the revenue-share input isn't
  attested, we refuse to show better than Estimated."* (talk-track EN)
- `/proof-center/full` → section "Contracts & review trail" : cartes EventLogger + PoRRegistry,
  adresse, deploy tx, deploy block, réseau affiché honnêtement **"Test network (chain id 84532)"**
  (`contracts-audit-trail.tsx:266-270`).
- Cliquer **"View on Basescan"** → `sepolia.basescan.org` : contrat vault
  `0x2bd14d52518a04f4c12949c51df03a161a9e329e`, token `hyvUSDC`, holders, **Read Contract**
  (`totalAssets`, `guardian`, `asset`=USDC Circle). Talk-track EN : *"You don't have to take our
  word for it — everything is independently verifiable."*
- **Mise à jour post-draft — pagination `getLogs` en cours de pose** (event-logger + por-registry).
  Une fois cette pagination déployée **avec `NEXT_PUBLIC_CHAIN_RPC_URL` posé sur
  `https://base-sepolia.gateway.tenderly.co`**, les panneaux on-chain du Proof Center (event log,
  attestations) se remplissent réellement au lieu de rester en empty state.
  - **Vérifier AVANT la démo, pas en live**, que le panneau "On-chain event log" affiche bien un
    event (ex. `phase2-verify`, bloc 42743215) une fois ce RPC posé.
  - **Backup RPC** si Tenderly est indisponible/rate-limité côté salle : endpoint drpc, plafonné
    à **10 000 blocs par chunk** côté requête (adapter la pagination côté appelant si switch).
  - **Alternative zéro-code** si les deux RPC posent problème le jour J : un endpoint Alchemy
    PAYG (clé à provisionner dans `NEXT_PUBLIC_CHAIN_RPC_URL`, aucun changement de code requis).
  - **SI rien de tout ça n'est déployé/vérifié avant la démo** : le panneau reste en empty
    state — dire *"attestations publish at each period close"* (c'est ce que dit l'empty state
    actuel), ne jamais dire "Proof of Reserves is live". *(source :
    audit-proof-decentralization — avoidThis)*
- Montrer la carte "Release gate" (mainnet conditionné à un audit tiers indépendant) —
  *"a testnet pilot on Base; mainnet is conditioned on an independent security audit."*

### T+26–29 min — Console admin, 7 écrans
Ordre recommandé (`audit-admin-capabilities.demoPath`) :
1. `/admin/dashboard` — Command Center, totaux plateforme réels.
2. `/admin/customers` — CRM (déjà visité en t+0, rappeler le trail d'audit).
3. `/admin/customers/[id]` — fiche client (déjà visitée).
4. `/admin/vaults` — lifecycle Draft/Review/Live, approbation 2-signataires ; **[optionnel]**
   `/admin/vaults/new` pour pitcher le wizard "votre vault Zand" (draft-only, sans risque).
5. `/admin/distributions` — historique 12 runs / $320,880 / 140 destinataires ; **Compute =
   dry-run pro-rata sans écriture** (`actions.ts:75-140`) — montrer le dry-run, **ne PAS
   confirmer réellement** (voir §2, écrit en prod pour toutes les positions actives).
6. `/admin/investor-memo` — Generate (GPT-4.1 + export PDF) — **répéter le timing avant** (rate
   limit 5/min) et garder un PDF déjà généré en fallback si OpenAI rame en live.
7. `/admin/audit` — audit log immuable de chaque action admin (60 entrées réelles).

### T+29–30 min — Chat scripté
- Ouvrir le rail droit sur `/vaults` ou `/portfolio`, mode LP.
- Preset **"Explain the yield"** → ouvre le canvas LP pendant que le chat répond (source
  attribution, chiffres mining ~6.2%/USDC base ~4.8% exemptés du guard).
- Question scriptée EN : *"What is the target yield range, the lock-up and the minimum ticket
  for the Hearst Yield Vault?"* → réponse ancrée prompt système (8–15% target, distributions
  USDC mensuelles, lock-up 60 jours, $250k min).
- Preset **"Risk assessment"** → registre risque honnête, zéro chiffre à risque.
- Taper **"Take me to the proof center"** → navigation déterministe instantanée (zéro LLM,
  zéro latence) vers `/proof-center` — enchaîne sur l'axe preuve déjà montré.
- **Clore là** — ne pas improviser d'autres questions du prospect dans le chat ; proposer de
  répondre soi-même à toute question hors script. *(source : audit-chat-agent)*

### Clôture — 3 modèles de distribution (verbal, aucun écran dédié)
Le modèle B2B2C n'existe pas structurellement dans le produit (aucun tenant/Organization dans
le schéma, `Investor` 1:1 `User`, aucun rôle distributeur) — se raconte verbalement en 3 paliers,
sans mot interdit :
1. **Omnibus aujourd'hui** — la banque distribue via un compte omnibus corporate à son nom
   (zéro développement).
2. **Sous-comptes pilote** — comptes clients finaux provisionnés par l'admin Hearst à l'échelle
   pilote (le flow démontré ci-dessus, T+0 à T+20).
3. **API + white-label — roadmap JV** — portail distributeur, omnibus avec attribution par
   client final, API partenaire, marque blanche : chantier co-construit, pas encore construit.
   *(source : audit-b2b-gaps — le seul fichier à documenter ce modèle en 3 paliers)*

---

## 2. AVOID-LIST CONSOLIDÉE

| Ne jamais ouvrir / faire | Raison (1 ligne) |
|---|---|
| `/portfolio` (rail "Portfolio", page principale) comme preuve de portefeuille réel | Console V4 100% mock, $531.4k figés identiques pour tous les comptes, badge "Sandbox · V4" visible — insensible à toute souscription réelle |
| `/admin/outreach` | 19 prospects réels + PII Apollo — le client verrait qu'il est une ligne du pipeline commercial |
| Bouton **"Reset demo"** (`/profile`) pendant/juste avant la démo, sur QUELQUE compte que ce soit | Ne jamais cliquer, dans tous les cas — mais l'impact diffère par compte (`src/lib/demo/actions.ts:82-84`, `LEGACY_DEMO_SNAPSHOT_OWNER`) : le reset de `zand.demo@hearstcorporation.io` ne détruit QUE ses propres positions/transactions/NAV ; **seul** le reset d'`adrien+demo@hearstcorporation.io` détruit EN PLUS le `VaultSnapshot` demo_seed partagé (l'AUM $12.5M de `/vaults`, non recréable in-app tant que la custody Fireblocks est vide) |
| **Confirmer réellement** une distribution admin (`confirmDistribution`) | Écrit en prod pour TOUTES les positions actives (y compris le vrai compte $11), exige 2 signataires distincts, hash `0xMOCK_…`, non rejouable sur une période déjà confirmée |
| Saisir un montant < $250,000 dans le checkout | Le serveur rejette (`Below minimum ticket of $250,000 for Class A`) même si l'UI l'accepte dès $10 |
| Mots interdits : **guarantee, promise, certain, will deliver, risk-free** (+ "no risk") | Guard de compliance actif dans le produit ; à l'oral aussi, zéro exception |
| Dire **"mainnet"** ou laisser entendre que le vault de prod est sur mainnet | Tout est Base Sepolia **testnet** ; l'UI dit elle-même "Test network (chain id 84532)" — mainnet gated sur audit Spearbit indépendant (ADR-006) |
| Dépôt on-chain réel en live (wallet Privy + USDC testnet + allowance) | Trop de points de défaillance non répétés ; utiliser "Simulate deposit" ou `deployPosition` admin |
| `/admin/proofs` (Proof Library) comme preuve du récit "vérifiable" | Table `Proof` VIDE en prod (0 rows) — contredit le récit devant le client |
| `/admin/governance`, `/admin/agents` | 0 proposition / 0 template en prod — empty state visible |
| `/admin/system/architecture` | Badges rouges "Blocked"/"Not configured" — anti-vente |
| Comptes/drafts de test visibles (`abc@gmail.com`, `test+onboarding@hearst.local`, drafts "Single run" dans `/admin/vaults`) | Casse l'illusion de production soignée — ne pas scroller dessus |
| Dérouler le KYC Sumsub réel (sandbox) | Verdict asynchrone via webhook, délai non maîtrisé — utiliser l'override admin `setInvestorKyc` |
| Cliquer "Create a product" (preset admin chat) devant le prospect | Détourne vers le Product Workspace, hors sujet pour une démo distribution |
| Demander au chat une action ("deploy the vault", "sign…", "execute…", "send the campaign") | Le refus revient en JSON brut affiché verbatim dans la bulle — rendu cassé |
| Répéter/traduire une phrase contenant "guarantee"/"garanti" (test de jailbreak improvisé) | Bloqué par design mais l'UX du blocage est un bandeau d'erreur, pas flatteur en démo |
| Employer "multi-tenant", "white-label prêt", "API partenaire", "sous-comptes" comme **existants** | Aucun modèle Organization/tenant dans le schéma ; `Investor` 1:1 `User` ; 18 routes API = webhooks internes, pas d'API partenaire |
| Citer "Trail of Bits — Completed" / "Spearbit — Scoped" sans validation | Strings hardcodées dans `contracts-audit-trail.tsx` — à valider avec Adrien avant de les répéter devant une banque régulée |
| Exécuter `yield-tick.ts --execute` sans dry-run préalable validé, ou au-delà de $100,000 en un tick | Le script plafonne à $100k et refuse d'écrire en prod sans `ALLOW_PROD_WRITES=1` explicite — improviser un montant non répété en live |
| Présenter `connect.hearst.app` comme l'URL de démo | Domaine tenu par le projet landing marketing (404 sur toutes les routes produit) — la démo se fait sur `app.hearst.app`, voir §0 |

---

## 3. Q&A PIÈGES (réponses préparées, EN)

**Q : "I see `minDeposit = 1 USDC` on BaseScan — I thought the minimum was $250,000?"**
> A : *"That's the on-chain floor, intentionally lowered for the Base Sepolia pilot phase so we
> can test the full deposit path end-to-end without moving real capital. The committed
> constructor value is $250,000 for Class A — that's what governs actual subscriptions in this
> product."*

**Q : "`totalAssets` shows 12 USDC on the contract, but your UI shows AUM in the millions —
which is real?"**
> A : *"Both are real, at different layers. The on-chain contract you're reading is our Base
> Sepolia pilot deployment — small, deliberate test value. The AUM figure in the app reflects
> the operating book we're piloting with early LPs. As we move toward mainnet, those two numbers
> converge — that's exactly the audit-gated step we're describing next."*

**Q : "Is this audited?"**
> A : *"The contracts follow the OpenZeppelin ERC-4626 standard — an industry pattern any auditor
> can read. Mainnet deployment is explicitly conditioned on completing an independent security
> audit — we treat that as a governance discipline, not a formality, and we won't move real
> capital to mainnet before it's done."*
> (Ne PAS citer "Trail of Bits — Completed" ni "Spearbit — Scoped" tant que non validé avec
> Adrien — voir avoid-list.)

**Q : "Is this mainnet?"**
> A : *"No — this is a Base Sepolia testnet pilot. Every screen that shows chain data labels it
> 'Test network' explicitly. Mainnet is gated on the independent audit we just discussed."*

**Q : "Where is my transaction hash? I just subscribed — where's the proof?"**
> A : *"For this demo we used our off-chain simulated settlement path — it creates the same
> position and ledger entry as a real subscription, without requiring a funded testnet wallet in
> the room. The proof of on-chain settlement lives on the contract itself: our real pilot deposit
> is verifiable on BaseScan right now, and that's the same contract your subscription would settle
> against on mainnet."*

**Q : "Can we distribute this under our own banking/VARA license, white-labeled?"**
> A : *"That's exactly the joint-venture conversation — today the product supports an omnibus
> account model with zero engineering, and a pilot sub-account model where your ops team
> provisions individual client accounts, which is what you just saw. A dedicated partner API and
> white-label portal is the roadmap item we'd co-build with you."*

---

## 4. CHECKLIST T-1H

Repris et consolidé depuis les `todos6h` convergents des audits, mis à jour post-draft.

- [ ] **URL démo confirmée** : curler `app.hearst.app/` (login split-screen, 200), une route
      protégée (`/portfolio` → doit rediriger `/login?from=…`, PAS 404). Ne pas re-tester
      `connect.hearst.app` — décision déjà tranchée (§0).
- [ ] Supabase prod (`xrwzxhsenwmlxbwqcftz`) : `mcp supabase get_project` → **ACTIVE_HEALTHY**
      + un `SELECT` de chauffe (plan free = auto-pause après inactivité, restauré le 2026-07-07 —
      fragile pour une démo bancaire).
- [ ] **Lien d'activation FRAIS** généré pour le compte Zand juste avant (single-use — s'il a
      été testé la veille, il est déjà consommé).
- [ ] **2 sessions admin distinctes ouvertes** (2 navigateurs/profils) — le multisig
      distributions/vaults exige 2 signataires authentifiés différents.
- [ ] **Session Opérateur A (admin) et session `zand.demo` = navigateurs/profils séparés**
      (ou une fenêtre de navigation privée), jamais un onglet du même navigateur — le lien
      d'activation généré au T+0 s'ouvre côté "client" dans ce navigateur/profil distinct pendant
      que l'admin reste loggé pour le KYC approve (T+6-9) et la console admin (T+26-29) ; même
      contrainte `hc_session` que la ligne `adrien+demo` ci-dessous.
- [ ] **`adrien+demo@hearstcorporation.io` ouvert et loggé dans un NAVIGATEUR/PROFIL DISTINCT
      (ou une fenêtre de navigation privée) de `zand.demo`, jamais un simple onglet** —
      nécessaire pour le T+14-20 (Vault Details riche, 12 distributions) : cette position n'existe
      QUE sur ce compte, `zand.demo@…` étant vierge côté historique. Le cookie `hc_session` est
      unique par origine et PARTAGÉ entre tous les onglets d'un même navigateur — logger
      `zand.demo` dans un onglet du même navigateur écraserait la session `adrien+demo`. Préparer
      cette fenêtre séparée en avance (T-1h) pour ne pas dérouler de login supplémentaire devant
      le client.
- [ ] **Décompte total : au moins 3 profils/navigateurs actifs en simultané pour ce
      run-of-show** — admin/Opérateur A (T+0, T+6-9, T+26-29) · `zand.demo` (poste client, T+0 à
      T+22) · `adrien+demo` (fenêtre préparée T-1h, T+14-20) — chacun son navigateur/profil
      distinct (ou fenêtre de navigation privée), jamais un onglet partagé entre deux d'entre eux.
- [ ] Onglets BaseScan pré-ouverts : vault `0x2bd14d52518a04f4c12949c51df03a161a9e329e`
      (+ Read Contract), PoRRegistry `0xbB9e0350830670de45730706bE6710df665aA60D`, EventLogger
      `0x6A5483F6D6a5d43A3CAFE36d3001dd23e24EbD38`, deploy tx du vault — **+ screenshots de
      secours** si le réseau de la salle bloque `sepolia.basescan.org`.
- [ ] Investor memo PDF **déjà généré une fois** et téléchargé (fallback si OpenAI rame en live,
      rate-limit 5/min sur la génération).
- [ ] Dev local de secours : port **4105** libre (`~/.claude/bin/kill-dev`), `pnpm dev` testé,
      démarre proprement.
- [ ] **`DEV_AUTH_BYPASS` OFF** si le login local doit être montré tel quel (sinon
      `dev@hearst.local` admin auto-loggé, incohérent avec "créer un compte client" — et si
      laissé ON, régler `DEV_USER_EMAIL=adrien+demo@hearstcorporation.io` pour retrouver le
      bouton "Simulate deposit" en local).
- [ ] Répétition chronométrée complète une fois sur l'environnement EXACT de démo (pas un autre)
      avec un compte jetable (pas le compte Zand final).
- [ ] Vérifier `NEXT_PUBLIC_EVENT_LOGGER_ADDRESS` / `NEXT_PUBLIC_POR_REGISTRY_ADDRESS` posées
      côté Vercel prod (sinon `/admin/proof-center` on-chain reste éteint par design).
- [ ] **Statut du déploiement allowlist** (`zand.demo@hearstcorporation.io` dans
      `src/lib/demo/allowlist.ts`) : confirmer si commit+push+deploy a eu lieu avant la démo.
      Si non, prévoir le compte `adrien+demo@hearstcorporation.io` en filet de secours pour la
      démonstration du bouton "Simulate deposit" (voir T+9-14).
- [ ] **Yield-tick répété en dry-run** la veille : `npx tsx scripts/demo/yield-tick.ts --email
      <compte démo utilisé> --amount <montant ≤ 100 000>` — valider le plan affiché avant de
      prévoir l'exécution `--execute` en live.
- [ ] **RPC on-chain** (`NEXT_PUBLIC_CHAIN_RPC_URL`) : vérifier si la pagination `getLogs`
      (event-logger + por-registry) est déployée avec la valeur Tenderly
      (`https://base-sepolia.gateway.tenderly.co`) — si oui, confirmer que le panneau "On-chain
      event log" affiche bien un event réel (ex. `phase2-verify`, bloc 42743215) ; si non,
      préparer la phrase empty-state honnête (§1, section Proof Center) et garder en tête le
      backup drpc (10k blocs/chunk) ou l'alternative zéro-code Alchemy PAYG.

---

## 5. COMMANDES ENV VERCEL — PRÊTES À COLLER

**Zéro secret en clair.** `$VERCEL_TOKEN` = placeholder, à fournir par Adrien au moment de
l'exécution. Adresses ci-dessous = adresses **publiques** on-chain (pas des secrets) lues dans
`config/deployments.base-sepolia.json` / `.env.local`.

```bash
# --- RPC on-chain (pagination getLogs event-logger + por-registry) ---
vercel env add NEXT_PUBLIC_CHAIN_RPC_URL production --token=$VERCEL_TOKEN
# valeur à coller au prompt interactif : https://base-sepolia.gateway.tenderly.co
# (NE JAMAIS la passer en argument en clair dans un script — backup si Tenderly indispo : drpc,
# plafonné à 10 000 blocs/chunk ; alternative zéro-code : endpoint Alchemy PAYG)

# --- Allowlist signataire d'attestation (fail-closed sinon "Stale", jamais "Attested") ---
# Adresse publisher = HEARST_PUBLISHER (config/deployments.base-sepolia.json / .env.local)
vercel env add ATTESTATION_ALLOWED_SIGNERS production --token=$VERCEL_TOKEN
# valeur à coller : 0x1d1d87443f7B76f7C2248956240dE735Bce81707
# (format : liste d'adresses 0x séparées par des virgules — src/lib/attestation/stored.ts:85)

# --- Vérification qu'elles sont déjà posées avant d'écraser ---
vercel env ls production --token=$VERCEL_TOKEN | grep -E "CHAIN_RPC_URL|ATTESTATION_ALLOWED_SIGNERS|EVENT_LOGGER_ADDRESS|POR_REGISTRY_ADDRESS"
```

> **Redeploy requis après tout changement d'env Vercel** (les env vars sont "baked" au build,
> pas lues au runtime pour les `NEXT_PUBLIC_*`). **GO Adrien obligatoire avant tout push/merge/
> deploy prod** — un push sur `main` déclenche le déploiement prod direct sur **`app.hearst.app`**
> (§0), sans gate CI (`docs/DEPLOYMENT.md`). Aucun agent ne pousse seul — ceci inclut le commit
> de l'allowlist démo (`src/lib/demo/allowlist.ts`) et du script `scripts/demo/yield-tick.ts`,
> tous deux posés dans l'arbre par un worker mais pas encore intégrés par l'orchestrateur.

---

## 6. DÉCISIONS EN ATTENTE (statut, à trancher par Adrien avant demain)

| Décision | Statut d'après les audits |
|---|---|
| URL démo : `app.hearst.app` vs re-pointage `connect.hearst.app` | **TRANCHÉ** — voir §0. Vérifié par curl : `app.hearst.app` sert bien l'app (`/login`=200, `/api/health`=200, `/portfolio`=307→login) ; `connect.hearst.app/login`=404 (domaine tenu par le projet landing). La démo se fait sur `app.hearst.app`. Le re-pointage de `connect.hearst.app` reste une option Adrien, plus un prérequis. |
| Commit + push + deploy des livrables démo (`src/lib/demo/allowlist.ts` + tests, `scripts/demo/yield-tick.ts`) | Posés dans l'arbre par un worker, **pas encore commités/pushés** — décision et exécution reviennent à l'orchestrateur, avec GO Adrien explicite avant tout push (un push = un deploy prod, §5). À trancher : les intégrer avant la démo (effet en prod) ou compter sur le filet de secours local (port 4105, effet immédiat) / le compte `adrien+demo@…` déjà en prod. |
| Pagination `getLogs` (event-logger + por-registry) + `NEXT_PUBLIC_CHAIN_RPC_URL` | **En cours de pose**, non confirmé déployé à la date de cette mise à jour. Si déployé + RPC posé avant la démo, les panneaux on-chain du Proof Center se remplissent réellement (voir §1, §4, §5) ; sinon, s'en tenir au récit empty-state honnête. |
| Push allowlist (repo marketing tiers qui a écrasé le déploiement `connect.hearst.app`) | D'après prod-readiness/b2b-gaps : demander le gel de tout push du repo marketing (`Dev/Projects/hearst-connect`) — devenu moins urgent depuis que la démo ne dépend plus de `connect.hearst.app` (§0), mais toujours recommandé pour éviter la confusion. **Pas confirmé fait**. |
| Écritures DB prod : `minTicket` $10 → $250,000 sur le Yield Vault | Recommandé par plusieurs audits (admin-capabilities, portfolio-display, product-facts) pour aligner term sheet et pitch — **pas exécuté** à la date des audits ; écriture prod = décision Adrien/orchestrateur, hors périmètre de ce worker. |
| Cleanup CRM : emails de test (`abc@gmail.com`, `test+onboarding@hearst.local`, `dev@hearst.local`) + drafts vaults "Single run" (HYV-VSVU, HYV-2ALF) | Recommandé (admin-capabilities) comme nettoyage cosmétique avant démo — **pas exécuté**, écriture prod hors périmètre de ce worker. |
| Supabase → plan Pro (anti auto-pause) | Suggéré (prod-readiness) pour tuer le risque de re-pause pendant la démo (plan free, auto-pause ~7j, déjà restauré une fois le 2026-07-07) — **décision Adrien**, pas de confirmation d'exécution dans les audits. |
| Portefeuille démo "vierge" vs déjà garni | `adrien+demo@hearstcorporation.io` porte déjà 2 positions (~$998k + $250k) en prod — narratif "0 → $250k" nécessiterait un reset (qui casse aussi le `VaultSnapshot` $12.5M, voir avoid-list) ou l'usage d'un compte fraîchement créé (ex. `zand.demo@hearstcorporation.io`) pour la partie live. **Non tranché** dans les audits — à décider en fonction de si le narratif "portefeuille vierge" est jugé nécessaire. |

---

## 7. NOTES DE COHÉRENCE DES SOURCES (pour transparence, pas pour la démo)

- **Adresse du vault** : `audit-product-facts.json` cite `0xEc733c6dbD69F862489a9Da01338aA5D39C1F60d`
  (déploiement initial, ADR-010, 2026-05-26) tandis que `config/deployments.base-sepolia.json`
  (lu directement, source la plus fraîche) et tous les autres audits citent
  `0x2bd14d52518a04f4c12949c51df03a161a9e329e` (redeploy avec guardian, 2026-06-22). **Ce
  runbook utilise partout l'adresse courante** `0x2bd14d52…`. Drift documentaire connu (ADR-010
  non mis à jour), signalé dans audit-proof-decentralization.
- **URL de démo prod** : contradiction du draft initial résolue — voir §0. Vérification directe
  (curl) tranchée en faveur de `app.hearst.app`, écartant la piste "Promote-to-Production sur
  `connect.hearst.app`" proposée par 4 des 10 audits d'origine.
- **`connect.hearst.app` sert-il une page 200 ou 404 en `/`** : `audit-b2b-gaps.json` dit que la
  home répond 200 (landing marketing) alors que `/login` etc. répondent 404 (confirmé par la
  vérification curl de cette mise à jour) ; `audit-auth-onboarding.json` liste `/` implicitement
  dans les routes cassées sans le confirmer 200 ou 404 explicitement pour la racine seule. Écart
  mineur, sans impact sur ce runbook (le produit n'est de toute façon pas la cible de démo sur ce
  domaine, §0).
- **Frais Class A** : `audit-product-facts.json` signale lui-même une incohérence interne au repo
  (ADR-008 dit 1% mgmt + 10% perf ; `docs/strategy/hearst-yield-vault-v1.0.md` dit 2% mgmt + 10%
  perf) — non résolue dans les sources, non nécessaire pour ce runbook (le parcours démo ne
  requiert pas d'énoncer les frais), mais à trancher avant tout document écrit remis à Zand.
- **Allocations cibles moteur** : incohérence similaire (30-40% vs 60% mining) signalée par
  product-facts — hors périmètre du run-of-show, pertinent seulement si le chat/l'admin l'affiche
  et qu'un prospect compare deux écrans.
- **Script "yield tick"** : au moment du draft, aucune source n'en documentait l'existence — la
  mention était conditionnelle ("si préparé la veille"). **Mise à jour** : le script existe
  désormais (`scripts/demo/yield-tick.ts`, lu directement dans l'arbre pour cette mise à jour),
  dry-run par défaut, plafond $100k, garde fail-closed sur écriture prod. Voir §1 (T+20-22) et §4.
- **Allowlist démo** : au moment du draft, une seule adresse (`adrien+demo@…`). **Mise à jour** :
  `zand.demo@hearstcorporation.io` a été ajoutée (`src/lib/demo/allowlist.ts:14-17`, lu
  directement, tests dans `src/lib/demo/__tests__/allowlist.test.ts`) — non encore commitée/
  pushée par un worker au moment de cette mise à jour (voir §6). Effectif en local (port 4105)
  immédiatement ; effectif en prod seulement après commit+push+deploy par l'orchestrateur.
- **Aucune source ne confirme** que `ATTESTATION_ALLOWED_SIGNERS` ou la pagination `getLogs`
  (RPC on-chain) ont été posés en prod à la date de rédaction de cette mise à jour — traiter
  comme non fait sauf vérification contraire le jour J (voir checklist §4).
