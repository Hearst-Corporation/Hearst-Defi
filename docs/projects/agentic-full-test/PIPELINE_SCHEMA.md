# PIPELINE_SCHEMA.md — Full Agentic Line: Future Schema (skeleton)

> Squelette posé par le batch 1/6 (architect). Aucun des deux schémas Control
> Center/Control Tower existants (`docs/agentic/AGENTIC_CONTROL_CENTER_V0.md`,
> `AGENTIC_VISUAL_CONTROL_CENTER_V0.md`) ne couvre les deux couches de la ligne
> agentique **dans un seul diagramme** : le Control Tower (`/admin/agentic`) topologise
> uniquement la Partie B (orchestration/observabilité), pas les 4 agents batch ni le
> moteur de chat cockpit (Partie A) comme nœuds explicites du même graphe. Ce document
> pose le squelette d'un schéma unifié — **à compléter par un futur batch/série** une
> fois que le comportement réel (canaries DLLM, formulations limites) aura été vérifié
> par les batchs 2-6 de cette série, pas avant (annoter le schéma avec des faits vérifiés,
> pas des hypothèses de doc).

## Pourquoi ce schéma n'existe pas encore ailleurs

- Le Control Tower (`/admin/agentic`, v2) est un registre **statique et read-only** de la
  Partie B uniquement (routeur, guards, HITL gates, tool boundary, crews/agents
  d'orchestration, observabilité). Il ne représente pas les 4 agents batch (Scenario
  Narrative, Mining Health, Risk Explanation, Investor Memo) ni les 3 modes du moteur de
  chat comme nœuds — ceux-ci sont documentés séparément (`docs/spec/09-agents.mdx`,
  `docs/prompts/*.md`).
- Aucun document actuel ne trace le chemin bout-en-bout **entrée utilisateur → routeur
  déterministe → (LLM ou fast-path) → guard de sortie → action readiness → tool
  boundary → exécution (draft/gated/bloqué)** en un seul graphe traversant les deux
  parties.

## Squelette du diagramme (Mermaid, à densifier)

```mermaid
flowchart TB
  subgraph INPUT["Entrée"]
    U[Message utilisateur / trigger cron / clic admin]
  end

  subgraph ROUTING["Partie B — Routage & garde-fous (déterministe, jamais de LLM ici)"]
    IR[Intent Router V2]
    ARM[Action Readiness Matrix]
    TB[Tool Boundary v1]
  end

  subgraph AGENTS["Partie A — Agents produit (OpenAI GPT-4.1)"]
    CHAT[Cockpit Chat — 3 modes: LP / Admin / Review]
    SNA[Scenario Narrative Agent]
    MHA[Mining Health Agent]
    REA[Risk Explanation Agent]
    IMA[Investor Memo Agent]
    OMA["Outreach Master Agent (hors périmètre code de cette série)"]
  end

  subgraph GUARD["Guard de sortie (dernière ligne de défense, jamais assoupli par intent)"]
    OG[Output/Compliance Guard]
  end

  subgraph EXEC["Exécution (jamais autonome au-delà de read_only)"]
    RO[read_only — exécuté directement]
    DRAFT[draft_or_proposal — persisté, jamais publié seul]
    GATE["confirmed_write — jeton HITL requis (userId,toolId,payloadHash)"]
    FORBID["forbidden_autonomous — bloqué inconditionnellement (8 actions)"]
  end

  subgraph OBS["Observabilité (métadonnées uniquement, jamais le texte utilisateur)"]
    ROBS[Router Observability]
    SOBS[Agentic Simulation Observability]
    QR[Router Quality Review]
    RC[Reporting Crew]
  end

  U --> IR
  IR -->|nav fast-path / refus dangereux / hint éducatif| CHAT
  IR -.->|métadonnées de décision, opt-in| ROBS
  CHAT --> ARM
  MHA --> ARM
  REA --> ARM
  SNA --> ARM
  IMA --> ARM
  OMA -.-> ARM
  ARM --> TB
  TB --> RO
  TB --> DRAFT
  TB --> GATE
  TB --> FORBID
  CHAT --> OG
  SNA --> OG
  MHA --> OG
  REA --> OG
  IMA --> OG
  OG -->|bloqué si mot interdit / APY single-point / assumption non citée| U
  ROBS --> QR
  QR --> RC
  SOBS --> RC
```

**Légende des styles à ajouter dans une future itération** : nœuds verts = déjà couverts
par cette série (voir `COVERAGE_MATRIX.md`) ; nœuds ambre = couverts indirectement
seulement ; nœuds rouges = gap confirmé. Ce marquage doit être fait **après** les batchs
2-6, pas maintenant (ce batch n'a pas encore de résultat de test à annoter).

## Ce qu'un futur batch de synthèse doit ajouter à ce schéma

1. **Annotations de couverture** par nœud, tirées de `REPORT_SKELETON.md` §4 une fois
   rempli (ex. si le batch 5 confirme un gap sur `mining-health.ts`, marquer le nœud
   `MHA` en rouge avec la raison).
2. **Cas limites observés en pratique** (pas seulement en théorie) — ex. si un canary
   DLLM du batch 5/6 révèle qu'un modèle réel formule parfois une réponse limite non
   couverte par le guard actuel, l'annoter directement sur l'arête `AGENTS --> OG`.
3. **Le swarm outreach** (`outreach_governed_swarm`) comme sous-graphe séparé, une fois
   que la série sœur `outreach-audit` aura documenté son comportement réel — ce schéma
   le laisse volontairement en pointillé (`-.->`) car hors périmètre de code de cette
   série (voir `PROJECT_PLAN.md` §Coordination).
4. **Le Daily Executive Brief Crew (A8)** une fois construit — actuellement absent du
   schéma car non implémenté (design ADR-018 forward uniquement).

## Sources à ne pas dupliquer (déjà correctes, juste pas unifiées)

- `docs/agentic/AGENTIC_VISUAL_CONTROL_CENTER_V0.md` — topologie détaillée de la Partie B
  seule (groupes, nœuds, arêtes) — réutiliser sa nomenclature de types de nœuds
  (router|guard|crew|agent|tool|gate|observability|surface) plutôt que d'en inventer une
  nouvelle si ce schéma est un jour implémenté en composant React réel.
- `docs/spec/09-agents.mdx` — contrats d'entrée/sortie exacts des 4 agents batch (Partie
  A), à citer plutôt qu'à reformuler si le schéma futur a besoin de détail par agent.
