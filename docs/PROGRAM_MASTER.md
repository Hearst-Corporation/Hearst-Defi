# Hearst — PROGRAM MASTER (Source of Truth)

> **Document unique de référence.** Toute personne rejoignant le projet lit CE fichier en premier.
> Consolidation au 2026-05-29. **Gel contrat : SHA `898991c6ee3c3bfe7637509ecee7ac579dc79388`**
> (les sources `contracts/src/` sont inchangées depuis le commit B6 `79d0ef9` ; `git diff 898991c HEAD -- contracts/src` = vide).
>
> **Règle de lecture :** quand un autre document diverge de celui-ci, **ce fichier (et la Source of Truth qu'il désigne section par section) prévaut**. Les divergences résiduelles connues sont listées en §8 et dans la table finale.

---

# 1. Executive Summary

**Hearst Yield Vault** est un produit DeFi institutionnel à vault unique : un coffre USDC (ERC-4626) offrant un **rendement structuré adossé au mining Bitcoin**, distribué mensuellement en USDC, sous structure **Cayman Exempted LP**, réservé aux **investisseurs professionnels/qualifiés** (ticket minimum $250k). Les trois promesses produit : **lisibilité** (comprendre la stratégie en 5 min, 4 écrans), **simulabilité** (Scenario Lab stresse toute hypothèse), **auditabilité** (Proof of Reserves, events on-chain, méthodologie publiée et versionnée).

**Vérité fondatrice (à ne jamais perdre) — « Model B » :** le vault **custodie l'USDC des LP en réserve cash et ne le déploie PAS on-chain**. Aucun rôle (owner, manager, guardian) ne peut extraire le principal ; la seule sortie de fonds est la redemption d'un actionnaire. Le mining est financé **off-chain** (SPV/Fireblocks) ; le **yield est une distribution de revenue-share mining injectée mensuellement** par transfer USDC dans le vault, ce qui fait monter la NAV automatiquement (NAV = `totalAssets` = solde USDC, sans oracle dans le calcul des parts). Le lock-up (60/90j) et le min-ticket ($250k/$1M) sont des **contrôles off-chain** (KYC/legal). *(Source : §3 + `docs/audit/spearbit-prep-2026-05-26/asset-lifecycle.md`.)*

**État technique (vérifié 2026-05-29) :** code **gelé** et vert — `pnpm typecheck` 0, `pnpm lint` 0, **vitest 1766/1766**, **forge 73/73**. Pack d'audit Spearbit **prêt**. Le blocage du lancement n'est **pas** la qualité du code mais des **intégrations tierces** (gouvernance on-chain à déployer, counsel, KYC/AML, custody, oracle/attestation) + un sprint de corrections app-code ciblées.

**Statut des gates :** *Paper pilots (testnet)* → atteignable ~30 j. *Audit Spearbit* → démarrable sous 1-2 semaines (pack prêt). *Mainnet / capital réel* → **NO-GO ferme** jusqu'à audit Spearbit complété + remédiation (ADR-006, non-négociable #8 du `CLAUDE.md`).

---

# 2. Product Definition

> **Source of truth produit :** `docs/spec/*.mdx` (00→09 + glossaire) + `docs/methodology/v1.0.md`. Le `CLAUDE.md` reste la source des non-négociables.

**Quoi.** Un seul vault — **Hearst Yield Vault (HYV-A)**, actif USDC. APY cible **8–15 %, TOUJOURS exprimé en range** (jamais un point unique). Distributions **mensuelles** en USDC.

**Pour qui.** LP **institutionnels / qualifiés uniquement** (family offices, asset managers, crypto funds, allocators). Pas de retail.

**Moteurs de rendement (modèle stratégique, off-chain — cf. §3).** Mining cashflow (revenue-share avec 1-2 fermes existantes — pas de fleet propre, ADR-003), base USDC (T-bills tokenisées + lending), BTC tactique (règles R-BTC-1→6), réserve stable.

**4 écrans MVP** (specs) : Dashboard (`01`), Scenario Lab (`02`, le *wedge* commercial), Proof Center (`03`), Investor Memo PDF (`04`). Plus le portfolio LP, le flux d'investissement, et la console admin.

**Non-négociables (CLAUDE.md, CI-enforced) :** (1) APY toujours en range ; (2) badge de provenance sur chaque métrique (Live/Oracle/Attested/Estimated/Manual/Stale) ; (3) format **PTAI** (Projection→Trigger→Action→Impact) pour simulations/rebalancing ; (4) pas de chat IA — agents = JSON structuré only ; (5) mots interdits dans les sorties agents (« guarantee », « promise », « certain », « will deliver », « risk-free ») ; (6) Scenario Engine pure-function (pas d'I/O) ; (7) Monte Carlo V2 autorisé à côté du rule-based, seed PRNG injecté ; (8) **mainnet gaté sur audit Spearbit** ; (9) multi-vault autorisé V1+ (chaque vault porte ses propres hypothèses) ; (10) chaque projection montre ses hypothèses + disclaimer « not guaranteed » ; (11) **aucun import cross-projet** (depuis `Dev/hearst-connect`).

---

# 3. Asset Lifecycle — le cycle de vie d'1 USDC (Model B)

> **SOURCE OF TRUTH UNIQUE :** `docs/audit/spearbit-prep-2026-05-26/asset-lifecycle.md` (clôt RR-SC-07). En cas de divergence avec tout matériel marketing/produit, ce document prévaut.

**Modèle implémenté = Model B** (vault de cash + yield exogène injecté). PAS Model A (actifs productifs on-chain), PAS Model C (hybride).

1. **Dépôt (on-chain).** L'USDC est transféré DANS le contrat à `deposit()` et y reste ; des parts sont émises (genèse : 1 USDC → 1e12 parts, `_decimalsOffset=12`).
2. **Custody (on-chain).** Le custodien est *le code* (logique ERC-4626 immuable). `totalAssets()` = solde USDC du vault.
3. **Financement du mining (OFF-CHAIN).** Le vault **ne peut pas** envoyer l'USDC au mining — **aucune fonction owner/manager de retrait n'existe**. Le mining est financé off-vault (SPV/Fireblocks) ; l'USDC du vault est une **réserve**.
4. **Retour de revenus (yield).** Le manager **transfère** de l'USDC mining-derived dans le vault (simple transfer ERC-20) → `totalAssets` ↑ → NAV/part ↑.
5. **NAV (on-chain, automatique).** NAV/part = `totalAssets / totalSupply`. Pas d'oracle, pas de setter manuel. La **PoR est advisory** — jamais lue par `convertToShares`/`convertToAssets`.
6. **Redemption (on-chain).** `redeem`/`withdraw` brûle les parts et renvoie l'USDC pro-rata. Toujours principal-solvable (tout l'USDC, principal + yield, est dans le contrat). **Aucun lock-up on-chain** : le soft-lock 60/90j est off-chain/legal.

**Réponses explicites :** le vault peut-il **envoyer** des fonds ? Oui — **uniquement** à un actionnaire qui rachète. Le vault peut-il **retirer** des fonds vers une stratégie ? **Non.** Le manager peut-il **déplacer** des fonds ? **Non** (il peut seulement *ajouter* de l'USDC, comme n'importe qui). Le mining est-il **on-chain** ? Non — **comptable/attestation only**.

**Position retenue (V1) :** modèle réserve (Path 1), **zéro code**, alignement PPM/LPA par counsel. Tout déploiement on-chain du principal serait une **V2 auditée séparément** (egress gouverné + NAV oracle-dépendante) — hors périmètre V1.

---

# 4. Smart Contract Architecture

> **SoT :** `contracts/src/*` @ `898991c` + `docs/audit/spearbit-prep-2026-05-26/{architecture,invariants}.md`. Dépendance gelée : **OpenZeppelin v5.6.1 @ `5fd1781b1454fd1ef8e722282f86f9293cacf256`**. Build : `solc 0.8.24`, optimizer 200, EVM `cancun`, `via_ir=false`. **forge 73/73 verts.**

| Contrat | Hérite (OZ v5.6.1) | Surface custom |
|---|---|---|
| `HearstYieldVault.sol` | `ERC4626`, `ERC20`, `Ownable`, `Pausable` | `_decimalsOffset()=12` (parts 18 déc / USDC 6 déc) ; floor `minDeposit` dans `_deposit` ; rôle `guardian` (`pause`/`unpause`, `onlyGuardian`) ; `setGuardian`/`setMinDeposit` (`onlyOwner`) ; `whenNotPaused` sur `_deposit` + `_withdraw`. Constructeur 6 args : `(asset, name, symbol, owner, guardian, initialMinDeposit)`, `require(guardian != address(0))` + script impose `guardian != owner`. **Pas de** subscribe/distribute/rebalance/permit/oracle/fee-logic/withdrawal-queue/upgrade. |
| `PoRRegistry.sol` | aucune | `publisher` immuable unique ; `publish()` append-only (1 attestation par période `YYYYMM`). Aucun rôle. |
| `EventLogger.sol` | aucune | `publisher` immuable unique ; `logEvent()` id monotone append-only. Aucun rôle. |

- **Asset :** USDC Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. `minDeposit` de déploiement = `250000000000` (250k USDC, indicatif).
- **B6 (commit `79d0ef9`) :** ajout `Pausable` + rôle `guardian` séparé de l'owner. Décision actée : **« Pausable + GUARDIAN only »** ; le role split lourd (ORACLE_REPORTER, withdrawal queue) reste **post-audit**.
- **⚠️ Instance testnet `0xEc733c6dbD69F862489a9Da01338aA5D39C1F60d` PRÉDATE le guardian (constructeur 5 args)** → **à redéployer** avec le constructeur 6 args avant le kickoff audit.
- **Invariants clés** (`invariants.md`) : round-trip ne crée jamais de valeur ; donation/inflation défaite par `_decimalsOffset=12` ; pause bloque entrée ET sortie ; owner ≠ guardian enforced au deploy ; publisher immuable append-only ; PoR jamais dans le share math.

---

# 5. Governance Model

> **SoT :** `docs/audit/spearbit-prep-2026-05-26/architecture.md` (modèle d'ownership) + `contracts/script/DeployGovernance.s.sol` + `contracts/test/Governance.t.sol` (13 tests). ADR-009 (multisig EIP-712).

```
Safe 3/5 (GOVERNANCE_SAFE) ──PROPOSER+EXECUTOR+CANCELLER──▶ TimelockController (48h, admin=0)
                                                                   │ owner du vault (après transferOwnership)
Guardian Safe 2/3 (GUARDIAN_SAFE) ──pause()/unpause()──▶ HearstYieldVault
GOVERNANCE_SAFE ──publisher (immuable)──▶ EventLogger + PoRRegistry
```

| Rôle | Détenteur cible | Pouvoirs | Ne peut PAS |
|---|---|---|---|
| **owner** (vault) | TimelockController(48h) ← Safe 3/5 | `setMinDeposit`, `setGuardian`, `transferOwnership` (toutes via proposition Timelock mûrie 48h) | déplacer des fonds ; pause ; upgrade |
| **guardian** | Safe 2/3 séparé (clé rapide) | `pause`/`unpause` uniquement | déplacer des fonds ; changer des params ; se roter lui-même |
| **timelock** | auto-administré (`admin=address(0)`) | impose 48h sur toute action owner ; `DEFAULT_ADMIN_ROLE` sur lui-même | agir hors opération mûrie ; pause |
| **publisher** | Safe 3/5 (immuable) | `logEvent` / `publish` (append-only) | déplacer des fonds ; réécrire l'historique |

- **48h timelock = pourquoi un guardian séparé :** une urgence ne peut pas attendre 48h → le guardian est une clé rapide **distincte** du Safe owner. Parité off-chain↔on-chain `hashOperation` vérifiée (vecteur `0xe13ea3a1e2109dd41ea773534291e0672cfdb9c44dfafc023132149975a9a036`).
- **Statut :** Timelock + Safe **non encore déployés** ; instance vault testnet à redéployer. Runbook complet : `docs/execution/agent-a-safe-governance.md`.
- **Gouvernance applicative off-chain** (`src/lib/governance/*`) = machine à états + hashing EIP-712 ; produit les hashes à signer dans le Safe, ne détient aucun fonds.

---

# 6. Legal & Fund Structure

> **SoT :** ADR-001 (structure), ADR-008 (share classes), et `asset-lifecycle.md` (formulation Model B à refléter au PPM). Brief counsel prêt : `docs/execution/agent-c-cayman-counsel.md`.

- **Véhicule :** Cayman **Exempted Limited Partnership (ELP)** — ADR-001. GP = Hearst Management Co. ; LP = investisseurs pro/qualifiés ; admin fund (Apex/Trident) ; counsel (Maples) ; audit (Withum/PwC).
- **Share classes (ADR-008 — SoT) :** Class A — $250k / lock 60j / **1 % mgmt + 10 % perf HWM**. Class B — $1M / lock 90j / **0,75 % mgmt + 8 % perf HWM**.
- **Distributions :** mensuelles USDC. **Lock-up et min-ticket = obligations off-chain** (LPA / subscription), pas de verrou on-chain.
- **À refléter au PPM/LPA (non négociable) :** principal LP = USDC en **réserve** dans le vault, **non déployé on-chain** ; yield = distribution mining-revenue-share injectée ; le manager ne peut extraire le principal. Le headline « mining-backed » est exact **avec** cette clarification.
- **Statut :** PPM/LPA **inexistants** ; counsel **non encore engagé** ; pages légales (`src/app/legal/*`) = drafts ingénieur **non revus counsel**. Engager Maples = décision D2 (cette semaine).

---

# 7. Audit Scope

> **SoT :** `docs/audit/spearbit-prep-2026-05-26/` (pack réconcilié, RR-SC-01) — README, scope, architecture, asset-lifecycle, invariants, threat-model, previous-findings, abi-freeze.json. **Freeze SHA `898991c`.** Le pack est considéré **PRÊT** (ne pas réauditer).

- **In scope :** les 3 contrats custom (`HearstYieldVault`, `PoRRegistry`, `EventLogger`, ~280 LOC bespoke sur OZ v5.6.1) + **revue de configuration** Timelock/Safe.
- **Out of scope :** source OZ/Safe (auditée upstream), frontend, gouvernance off-chain, scenario engine, agents LLM, jobs Inngest, Fireblocks, DB.
- **Self-review pré-audit (`previous-findings.md`) :** PRE-02 (donation/inflation → `_decimalsOffset=12`, mitigé) ; PRE-01 (posture reentrancy — pas de `ReentrancyGuard`, jugement auditeur) ; PRE-10 (split guardian/owner) ; PRE-11 (pas de manager-withdraw = hypothèse off-chain) ; PRE-09 (homoglyphes linter, off-chain, **ouvert**). Les anciennes claims fantômes (subscribe/distribute/ORACLE_UPDATER/permit) ont été **retirées** lors de RR-SC-01.
- **Budget :** $60–120k ; firmes : Spearbit (primary), Trail of Bits + OpenZeppelin Security (backups). Email prêt : `docs/execution/agent-b-spearbit.md`.
- **Préconditions kickoff :** redéployer le vault (guardian), renseigner les adresses déployées dans `abi-freeze.json` + `contracts/README.md`, provisionner l'accès repo @ `898991c`.

---

# 8. Open Risks

> Risques **ouverts** (non encore mitigés). Les findings d'audit smart-contract relèvent de Spearbit.

| ID | Risque | Sév. | SoT / mitigation prévue |
|---|---|---|---|
| RP-1 | Distribution affichée "payée" avec txHash mock `0xMOCK_` (`atomic-exec.ts`) — paiement sans transfert USDC réel | **Critique** | Décision D7 ; câbler le transfer réel post-Safe (hors gel contrat) |
| RP-2 | Dépôt possible **sans KYC approuvé** (`subscribe.ts` n'inspecte pas `kycStatus`) | **Critique** | Correction **C-01** (`agent-e`), P0 |
| RP-3 | Comm « mining-backed » sans clarification Model B → misrepresentation | **Élevé** | PPM/LPA aligné (D2) + corrections C-07/C-13 |
| RP-4 | NAV de-facto sur CoinGecko (Chainlink jamais appelé : client `chain:mainnet` + RPC Base Sepolia) | **Élevé** (mainnet) | RPC mainnet séparé (P2) ; testnet pilote sur CoinGecko documenté |
| RP-5 | Attestation mining = mock EIP-191 (pas de vendor Luxor/Coin Metrics) ; `ATTESTATION_ALLOWED_SIGNERS` vide | **Élevé** | Vendor + contrat revenue-share + poser l'allowlist |
| RP-6 | Gouvernance/PoR/exécution encore **simulées** (executeProposal DB-only, PoR non publié, distribution mock) | **Élevé** | Post-Safe (D1) + runbooks `agent-a` |
| RP-7 | Fees : défaut Prisma `VaultDeployment.mgmtFeeBps=200` (2 %) **contredit** ADR-008 (1 %) | **Moyen** | **Divergence — SoT = ADR-008 (1 %)** ; correction **C-04** |
| RP-8 | Env prod manquants (Inngest/Redis = hard-fail boot ; Privy/Persona/DocuSign) | **Élevé** | Poser les env (`agent-a`/infra) avant deploy |
| RP-9 | MFA TOTP admin installé non câblé ; CSP `unsafe-inline/eval` + `connect-src` wildcard | Moyen | Corrections C-09/C-10/C-11/C-12 |

**Divergences résiduelles connues (à trancher, non inventées) :**
- **Fees** : ADR-008 (1 %) vs défaut Prisma (2 %). **SoT = ADR-008** ; le défaut Prisma est un bug (C-04).
- **Methodology** : `v1.0.md` (active, immuable — **SoT V1**), `v2.0.md` (active, Monte Carlo V2), **`v2.1-draft.md` NON ratifié** (params Class B divergents : lock 30j/hurdle — **non autoritatif**, ne pas utiliser).
- **Freeze SHA historique** : anciens docs citaient `8ba18c9` (placeholder) puis `79d0ef9` (B6). **SoT = `898991c`** (contracts/src inchangé depuis `79d0ef9`).
- **CLAUDE.md « big picture »** (« 11 MVP tables », « no test runner ») est **périmé** ; l'état réel est 45 modèles Prisma + vitest/playwright/foundry câblés. Ce master réconcilie ; les non-négociables du CLAUDE.md restent valides.

---

# 9. Decisions Already Taken

> Décisions **fermées** (ne pas rouvrir). RR = Risk Resolution ; D = décision exécutive (Launch Program).

**Décisions structurantes (closes) :**
- **RR-SC-01** — Pack Spearbit **réconcilié** avec le code réel (claims fantômes retirées). Pack **PRÊT**. *(commit `850082c`)*
- **RR-SC-07** — Architecture = **Model B** (vault cash réserve, mining off-chain, yield injecté). Position : **modèle réserve V1, zéro code**, déploiement on-chain = V2. *(commit `7646e64`, `asset-lifecycle.md`)*
- **B6 design** — Vault `Pausable` + **guardian séparé de l'owner timelocké** (« Pausable + GUARDIAN only » ; role split lourd différé post-audit). *(commit `79d0ef9`)*
- **ADR-006** — Mainnet gaté sur audit Spearbit + remédiation (inchangé). Monte Carlo (V2) + multi-vault autorisés.
- **ADR-011** — LLM = **OpenAI GPT-4.1** (`openai` SDK, `OPENAI_API_KEY`), modèle unique pour les 4 agents + chat cockpit (pas de SDK Anthropic). *Supersede ADR-007 (Kimi K2.6 via Hypercli, retiré).*

**Décisions exécutives (Launch Program v1) :**
| # | Décision | Statut |
|---|---|---|
| **D1** | Désigner les 5 signataires Safe 3/5 + la clé guardian (Safe 2/3) | à exécuter (cette semaine) |
| **D2** | Engager le counsel Cayman (Maples) avec `asset-lifecycle.md` | à exécuter (cette semaine) |
| **D3** | Lever le **gel app-code ciblé** pour le sprint correctness (≠ gel contrat) | **validé** |
| **D4** | Signer l'engagement Spearbit (NDA + scope) + backups | à exécuter (cette semaine) |
| **D5** | Périmètre juridictionnel pilotes (exclure US persons sauf Reg D 506(c)) | à exécuter (cette semaine) |
| **D6** | Acter **Model B (réserve)** comme vérité produit V1 | **validé** |
| **D7** | Politique distribution V1 : transfert USDC réel treasury→vault (pas de `0xMOCK_` en prod) | à exécuter |

**Garde-fou permanent :** deux gels distincts — le **gel CONTRAT** (`contracts/src` @ `898991c`, pour Spearbit, **intact**) et le **gel APP-CODE** (levé de façon ciblée pour le sprint correctness, qui ne touche jamais `contracts/src`).

---

# 10. Current Execution Program

> **SoT :** `docs/execution/agent-{a,b,c,d,e}.md` (5 livrables prêts à l'emploi, committés `c46264c`).

- **agent-a** — Runbook Safe 3/5 + guardian 2/3, matrice des rôles, checklist de déploiement (commandes `forge`), checklist de validation on-chain + smoke tests.
- **agent-b** — Email Spearbit (+ backups), scope final, docs à transmettre, data room checklist.
- **agent-c** — Email Maples, brief counsel Model B, questions counsel, docs à transmettre.
- **agent-d** — Politique KYC/AML V1, parcours onboarding 0→7, critères accept/reject, checklist conformité pilote.
- **agent-e** — **14 corrections app-code** (C-01→C-14) avec `fichier:ligne`, priorisation P0/P1/CI, ordre d'exécution par lots, critères de validation. **Aucune ne touche `contracts/src`.**

**Corrections P0 (bloquant pilote) :** C-01 gate KYC · C-02 alias env vault · C-04 fees 2 %→1 % · C-05 tax-preview off · C-06 APY range PDF · C-08 persistance accréditation · C-13 one-liner Model B LP.

---

# 11. 30 / 60 / 90 Day Plan

> **SoT :** Launch Program v1 (consolidé ici) + `docs/execution/*`. J1 ≈ 2026-06-01 ; kickoff Spearbit cible 2026-06-08.

- **J0–J30 — Enable paper pilots + start audit.** Déployer Safe 3/5 + guardian → Timelock → vault (guardian) → EventLogger/PoR → `transferOwnership`. Poser env prod. Sprint correctness (C-01→C-14). Engager Maples (PPM/LPA Model B). Activer Persona prod + AML. Signer Spearbit (NDA/scope), kickoff J8. Premières démos paper-pilot testnet.
- **J30–J60 — Audit in flight + hardening.** Audit + remédiation. PPM/LPA finalisés + subscription DocuSign. Term sheet mining partner. Mécanismes réels (yield injection, PoR publish, fan-out distribution). Runbooks ops.
- **J60–J90 — Audit close + mainnet readiness.** Re-audit OK → **gate ADR-006 signé**. Distribution réelle on-chain, governance exec réelle, oracle mainnet séparé, attestation vendor. Deploy Base mainnet (post-sign-off). 1er closing capital réel.

---

# 12. Go / No-Go Matrix

| Gate | Verdict | Critères de sortie | Bloquants ouverts |
|---|---|---|---|
| **G1 — Paper pilots (testnet)** | 🔴 **NO-GO aujourd'hui** | Safe+Timelock+vault(guardian)+EventLogger/PoR déployés · env posés · gate KYC actif (C-01) · Persona prod · sprint correctness P0 fait · PPM Model B + stubs revus counsel · AML en place | D1, D2, D3-exec, KYC prod, env |
| **G2 — Audit Spearbit start** | 🟡 **GO conditionnel** | Pack PRÊT ✅ · NDA + scope signés · accès repo `898991c` · build reproductible vérifié · adresses testnet renseignées · counsel a aligné PPM Model B | D4, accès, redeploy adresses |
| **G3 — Mainnet / capital réel** | 🔴 **NO-GO ferme (ADR-006)** | Rapport Spearbit final, 0 critical/high ouvert, mediums fermés/justifiés · re-audit OK · gate ADR-006 signé · distribution réelle + PoR publié + governance exec réelle · oracle mainnet · contrat mining + attestation réelle | Audit non démarré + 3 mécanismes simulés + vendors |

---

# 13. Appendix — documents détaillés

**Code & contrats** (gel `898991c`) : `contracts/src/{HearstYieldVault,PoRRegistry,EventLogger}.sol` ; `contracts/script/{DeployHearstYieldVault,DeployGovernance,DeployBaseSepolia}.s.sol` ; `contracts/test/*` (73/73).

**Pack audit (SoT audit)** : `docs/audit/spearbit-prep-2026-05-26/{README,scope,architecture,asset-lifecycle,invariants,threat-model,previous-findings}.md` + `abi-freeze.json`.

**Décisions** : `docs/decisions/ADR-001…010-*.md`.

**Produit/méthodo** : `docs/spec/00→09 + 99-glossary.mdx` ; `docs/methodology/v1.0.md` (SoT V1), `v2.0.md` (MC V2), `v2.1-draft.md` (NON ratifié).

**Exécution (SoT exécution)** : `docs/execution/agent-{a,b,c,d,e}.md`.

**Vendor onboarding** : `docs/vendor-onboarding/{README,spearbit-email,persona,docusign,fireblocks}.md`.

**Commits clés (programme) :** `249bb7d` Lot A · `79d0ef9` B6 · `2a61dee` ABI freeze · `9c0c4c2` B5 governance · `52c98d5` B7 onboarding · `898991c` B3 (= freeze) · `850082c` RR-SC-01 · `7646e64` RR-SC-07 · `c46264c` execution package.

---

## Table des documents — DOCUMENT | STATUS | SOURCE OF TRUTH

| Document | Status | Source of truth de… |
|---|---|---|
| **`docs/PROGRAM_MASTER.md`** (ce fichier) | ✅ Actif | **Programme global** (point d'entrée unique) |
| `docs/audit/spearbit-prep-2026-05-26/asset-lifecycle.md` | ✅ Actif | **Model B / cycle de vie USDC (RR-SC-07)** |
| `docs/audit/spearbit-prep-2026-05-26/scope.md` | ✅ Actif | **Périmètre d'audit** |
| `docs/audit/spearbit-prep-2026-05-26/architecture.md` | ✅ Actif | **Modèle d'ownership / gouvernance on-chain** |
| `docs/audit/spearbit-prep-2026-05-26/invariants.md` | ✅ Actif | **Invariants contrat** |
| `docs/audit/spearbit-prep-2026-05-26/threat-model.md` | ✅ Actif | **Modèle de menace** |
| `docs/audit/spearbit-prep-2026-05-26/previous-findings.md` | ✅ Actif | **Self-review pré-audit** |
| `docs/audit/spearbit-prep-2026-05-26/README.md` + `abi-freeze.json` | ✅ Actif | **Pack/logistique audit + ABI gelée** |
| `contracts/src/*` @ `898991c` | ✅ Gelé | **Vérité contrat exécutable** |
| `docs/decisions/ADR-001…010` | ✅ Actif | **Décisions d'architecture** (append-only) |
| `docs/decisions/ADR-008-share-classes.md` | ✅ Actif | **Share classes / fees** (prévaut sur défaut Prisma) |
| `docs/methodology/v1.0.md` | ✅ Actif (immuable) | **Méthodologie projections V1** |
| `docs/methodology/v2.0.md` | ✅ Actif | **Monte Carlo (V2)** |
| `docs/methodology/v2.1-draft.md` | 🟠 Draft | *(non autoritatif — ne pas utiliser)* |
| `docs/spec/00→09 + 99` | ✅ Actif | **Spécification produit** |
| `docs/execution/agent-{a..e}.md` | ✅ Actif | **Programme d'exécution (war room)** |
| `docs/vendor-onboarding/*` | ✅ Actif | **Procédures vendors** (Persona/DocuSign/Fireblocks/Spearbit) |
| `docs/strategy/hearst-yield-vault-v1.0.{md,html,pdf}` | 🟡 Actif (à aligner) | Matériel commercial — **doit refléter Model B** (subordonné à `asset-lifecycle.md`) |
| `docs/roadmap.json` + `docs/roadmap-status-2026-05-26.md` | 🟡 Référence | Roadmap historique — subordonnée à §10/§11 |
| `docs/audit/spearbit-kickoff.md` | 🟠 Superseded | Remplacé par le pack `spearbit-prep-2026-05-26/` |
| `docs/audit/{horizon,qa-2026-05-26,coherence-2026-05-26,SYNTHESE,experience-*,interface-*,flow-redesign-*}` | 🟠 Archivable | Audits internes historiques (état figé 2026-05-2x) |
| `docs/ANALYSE-DEPARTEMENTS-2026-05-23.md`, `docs/PLAN-GLOBAL-2026-05-23.md` | 🟠 Archivable | Snapshots de planning antérieurs — remplacés par ce master |
| `docs/orchestration/coordination.md` | 🟠 Archivable | Coordination antérieure — remplacée par §10 |
| `CLAUDE.md` (« big picture ») | 🟡 Partiel | Non-négociables = actifs ; description d'architecture = périmée (réconciliée ici) |

## Documents redondants / archivables

À déplacer sous `docs/_archive/` (conserver pour l'historique, **retirer de la circulation active**) :
1. `docs/audit/spearbit-kickoff.md` — **redondant** avec `spearbit-prep-2026-05-26/README.md` (le pack est la SoT audit).
2. `docs/audit/{horizon-2026-05-26.html, qa-2026-05-26/, coherence-2026-05-26/, SYNTHESE-2026-05-21.html, experience-2026-05-21.html, experience-2026-05-22.html, interface-2026-05-21.html, flow-redesign-2026-05-26.html, flow-audit-prompt.md, screenshots/}` — audits internes historiques, état figé ; **archivables** (leurs findings résiduels sont consolidés en §8).
3. `docs/ANALYSE-DEPARTEMENTS-2026-05-23.md`, `docs/PLAN-GLOBAL-2026-05-23.md`, `docs/roadmap-status-2026-05-26.md`, `docs/orchestration/coordination.md` — planning/coordination antérieurs **remplacés par ce master** (§10/§11).
4. `docs/methodology/v2.1-draft.md` — **garder mais marquer NON ratifié** (non redondant, simplement non autoritatif — ne jamais l'utiliser pour des paramètres V1).

À **ne pas** archiver (vérité vivante) : le pack `spearbit-prep-2026-05-26/`, `docs/execution/*`, les ADR, `docs/spec/*`, `docs/methodology/v1.0.md` & `v2.0.md`, `docs/vendor-onboarding/*`, et ce `PROGRAM_MASTER.md`.

---

*Fin du PROGRAM MASTER. Consolidation uniquement — aucune nouvelle analyse, aucune invention. Toute divergence non listée en §8 doit être remontée et tranchée par désignation d'une Source of Truth, jamais par duplication.*
