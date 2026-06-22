import type { ChatMode } from "@/lib/llm/chat-modes";

export type AgentCapabilityKind =
  | "response"
  | "navigation"
  | "read_tool"
  | "write_tool"
  | "review";

export type AgentCapabilityTestStatus = "untested" | "red" | "orange" | "green";

export interface AgentCapabilityDefinition {
  id: string;
  label: string;
  mode: ChatMode;
  kind: AgentCapabilityKind;
  description: string;
  testPrompt: string;
  successCriteria: string;
  initialStatus?: AgentCapabilityTestStatus;
  initialNote?: string;
}

export const AGENT_CAPABILITY_DEFINITIONS: AgentCapabilityDefinition[] = [
  {
    id: "normal-product-qa",
    label: "Produit / vault Q&A",
    mode: "normal",
    kind: "response",
    description:
      "Répond aux questions produit, vaults, rendement, custody et proof center avec garde-fous compliance.",
    testPrompt: "Explique le Hearst Yield Vault en 3 phrases.",
    successCriteria:
      "Réponse concise, française, sans promesse, avec APY en fourchette et ton produit correct.",
    initialStatus: "green",
    initialNote:
      "Câblé + testé via runChatAgent (ADR-017). route.guard.test : une réponse 'rendement garanti' / 'APY 11%' est bloquée (BLOCK_SENTINEL) avant le LP ; une réponse en fourchette passe. CHAT_MASTER_AGENT=0 → 503 (kill-switch), pas de second moteur.",
  },
  {
    id: "normal-portfolio-context",
    label: "Contexte portefeuille utilisateur",
    mode: "normal",
    kind: "response",
    description:
      "Utilise le contexte portefeuille injecté quand il existe pour répondre sans inventer les chiffres.",
    testPrompt: "Pourquoi mon portefeuille est stale ?",
    successCriteria:
      "La réponse s'appuie sur le contexte réel ou dit explicitement qu'une donnée manque.",
    initialStatus: "green",
    initialNote:
      "buildPortfolioContextBlock(userId) injecté dans enrichedSystemPrompt (route.ts). Scope strict userId, null si 0 position. Couvert par chat-context.test (scoping cross-tenant + fraîcheur).",
  },
  {
    id: "normal-lp-navigation",
    label: "Navigation LP whitelistee",
    mode: "normal",
    kind: "navigation",
    description:
      "Peut ouvrir une page produit whitelistee quand le Master Agent décide de naviguer.",
    testPrompt: "Ouvre mon portefeuille.",
    successCriteria:
      "Le chat ouvre la bonne route produit sans sortir de la whitelist autorisee.",
    initialStatus: "green",
    initialNote:
      "navigate tool OU fallback keyword LP (resolveLpNavDestinationKey) quand le modèle répond en texte seul. Couvert par chat-agent + navigate-tool + route tests.",
  },
  {
    id: "review-distill-chat",
    label: "Distillation review document",
    mode: "review",
    kind: "review",
    description:
      "Distille la conversation en document de modifications structure quand on lance la generation.",
    testPrompt: "Passe en Review puis clique Generer le document.",
    successCriteria:
      "Le stream se termine avec un document exploitable dans la modale review.",
    initialStatus: "green",
    initialNote:
      "Tests ciblés review/admin chat controls passés. Le chemin Review est branché et validé une fois automatiquement.",
  },
  {
    id: "admin-ops-qa",
    label: "Ops / architecture interne",
    mode: "admin",
    kind: "response",
    description:
      "Repond comme copilote interne sur architecture, allocations, proofs, deploiements et runbooks.",
    testPrompt: "Explique le runbook de deploiement du vault en 5 etapes.",
    successCriteria:
      "La reponse reste interne, actionnable, sans execution autonome ni fuite sensible.",
    initialStatus: "green",
    initialNote:
      "COCKPIT_ADMIN_SYSTEM_PROMPT + buildAdminContextBlock (snapshot read-tools lintés). Write tools jamais auto-exécutés (chat-agent). Q&A et read tools model-driven passent par runChatAgent ; CHAT_MASTER_AGENT=0 coupe tout le chat (503).",
  },
  {
    id: "admin-product-workspace-open",
    label: "Ouvrir Product Workspace",
    mode: "admin",
    kind: "navigation",
    description:
      "Ouvre automatiquement Product Workspace pour une creation ou un cadrage de vault/produit.",
    testPrompt: "Creer un nouveau vault Defensive.",
    successCriteria:
      "Le chat ouvre /admin/product-workspace avec autostart et objective pre-remplis.",
    initialStatus: "green",
    initialNote:
      "Override navigate + fallback intent (route.ts). autostart+objective → ChatNavBridge. Indisponible si CHAT_MASTER_AGENT=0 (503).",
  },
  {
    id: "admin-scenario-lab-open",
    label: "Ouvrir Scenario Lab",
    mode: "admin",
    kind: "navigation",
    description:
      "Ouvre Scenario Lab pour une intention de simulation explicite ou en secondaire d'un cadrage produit.",
    testPrompt: "Simuler un scenario BTC bear sur le vault.",
    successCriteria:
      "Le chat ouvre /admin/scenario-lab ou l'ajoute comme etape secondaire pertinente.",
    initialStatus: "green",
    initialNote:
      "Parité Product Workspace : navigate(admin-scenario-lab) + fallback intent simulation. Indisponible si CHAT_MASTER_AGENT=0 (503).",
  },
  {
    id: "admin-new-client-action",
    label: "Nouveau client / create investor",
    mode: "admin",
    kind: "write_tool",
    description:
      "Créer un nouveau client/investor depuis le chat ou ouvrir directement la surface customer adaptée.",
    testPrompt: "Crée un nouveau client et ouvre la fiche customer.",
    successCriteria:
      "Le chat sait au minimum ouvrir la bonne surface customer, idéalement préremplir sans sortie de scope.",
    initialStatus: "orange",
    initialNote:
      "Navigation admin-customers + fallback keyword. Pas de write tool create_investor — ouverture surface seulement (write tool HITL à brancher si besoin).",
  },
  {
    id: "admin-email-send-action",
    label: "Envoyer des emails / outreach",
    mode: "admin",
    kind: "write_tool",
    description:
      "Préparer ou envoyer un email/outreach depuis le chat sur une surface dédiée.",
    testPrompt: "Prépare puis envoie un email de prospection à un nouveau client.",
    successCriteria:
      "Le chat doit soit ouvrir une surface outreach dédiée, soit exécuter un flux explicitement confirmé.",
    initialStatus: "orange",
    initialNote:
      "Navigation admin-outreach + write tools HITL (outreach_source_leads, outreach_draft_email, outreach_trigger_send_run) via panneau Actions admin — pas d'auto-exec modèle. Envoi réel gouverné par OUTREACH_AUTONOMY (ADR-016).",
  },
  {
    id: "admin-read-allocations",
    label: "Lire allocations canoniques",
    mode: "admin",
    kind: "read_tool",
    description: "Lit les allocations canoniques des vaults.",
    testPrompt: "Donne-moi les allocations canoniques des vaults.",
    successCriteria:
      "Le resultat restitue les allocations attendues sans mutation ni invention.",
    initialStatus: "green",
    initialNote:
      "Read tool branché + tests registry/chat-tools. (a) Panneau admin execute_read — indépendant du kill-switch chat. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-read-market-snapshot",
    label: "Lire market snapshot",
    mode: "admin",
    kind: "read_tool",
    description: "Lit le dernier snapshot mining et vault.",
    testPrompt: "Quel est le dernier market snapshot ?",
    successCriteria:
      "Le resultat renvoie les signaux de marche disponibles avec fraicheur honnete.",
    initialStatus: "green",
    initialNote:
      "Read tool branché + tests registry/chat-tools. (a) Panneau admin execute_read — indépendant du kill-switch chat. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-read-routes-index",
    label: "Lire routes index",
    mode: "admin",
    kind: "read_tool",
    description: "Lit un index d'exemple des routes produit/admin.",
    testPrompt: "Liste les routes cle pour une demo admin.",
    successCriteria:
      "Le resultat cite les routes pertinentes pour la demo sans sortir du scope.",
    initialStatus: "green",
    initialNote:
      "Read tool branché + tests registry/chat-tools. (a) Panneau admin execute_read — indépendant du kill-switch chat. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-read-specs-index",
    label: "Lire specs index",
    mode: "admin",
    kind: "read_tool",
    description: "Lit un index d'exemple des spec docs.",
    testPrompt: "Quelles specs couvrent les vaults et la gouvernance ?",
    successCriteria:
      "Le resultat pointe les specs indexees pertinentes.",
    initialStatus: "green",
    initialNote:
      "Read tool branché + tests registry/chat-tools. (a) Panneau admin execute_read — indépendant du kill-switch chat. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-read-runtime-capabilities",
    label: "Lire runtime capabilities",
    mode: "admin",
    kind: "read_tool",
    description: "Expose la matrice de capacites runtime actuellement outillees.",
    testPrompt: "Dis-moi ce que tu peux faire reellement dans ce chat.",
    successCriteria:
      "Le resultat distingue clairement navigation, lecture, limites et actions non outillees.",
    initialStatus: "green",
    initialNote:
      "Read tool branché et cohérent avec l'audit runtime actuel.",
  },
  {
    id: "admin-generate-chart-spec",
    label: "Generate chart spec",
    mode: "admin",
    kind: "read_tool",
    description: "Genere une spec de graphique deterministe a partir des donnees disponibles.",
    testPrompt: "Genere un chart spec pour APY vs risk sur 30 jours.",
    successCriteria:
      "Le JSON/tool output contient une spec exploitable avec type, serie, timeframe et provenance.",
    initialStatus: "green",
    initialNote:
      "Utility admin branchée + testée. (a) Panneau form /api/admin/chat-tools. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-generate-demo-plan",
    label: "Generate demo plan",
    mode: "admin",
    kind: "read_tool",
    description: "Genere un plan de demo ordonne pour l'admin a partir des routes/specs.",
    testPrompt: "Genere un demo plan pour presenter le produit a des stakeholders internes.",
    successCriteria:
      "Le resultat ordonne correctement les etapes et les routes a presenter.",
    initialStatus: "green",
    initialNote:
      "Utility admin branchée + testée. (a) Panneau form /api/admin/chat-tools. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-export-demo-pack",
    label: "Export demo pack",
    mode: "admin",
    kind: "read_tool",
    description:
      "Produit un pack de demo structure avec plan, graphiques et checklist.",
    testPrompt: "Exporte un demo pack pour un walkthrough admin.",
    successCriteria:
      "Le resultat contient un pack structure avec metadata, plan, charts et checklist.",
    initialStatus: "green",
    initialNote:
      "Utility admin branchée + testée. (a) Panneau form /api/admin/chat-tools. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-export-briefing-pack",
    label: "Export briefing pack",
    mode: "admin",
    kind: "read_tool",
    description:
      "Produit un executive briefing pack structure pour usage interne.",
    testPrompt: "Exporte un briefing pack pour un IC interne.",
    successCriteria:
      "Le resultat contient un briefing executive exploitable avec synthese et action plan.",
    initialStatus: "green",
    initialNote:
      "Utility admin branchée + testée. (a) Panneau form /api/admin/chat-tools. (b) Model-driven via runChatAgent en mode admin.",
  },
  {
    id: "admin-create-review-note-draft",
    label: "Create review note draft",
    mode: "admin",
    kind: "write_tool",
    description:
      "Prepare un draft de review note via confirmation humaine obligatoire.",
    testPrompt: "Prepare une review note draft sur le vault.",
    successCriteria:
      "Le systeme demande d'abord une confirmation, puis execute seulement apres validation.",
    initialStatus: "green",
    initialNote:
      "Write tool UI + confirmation flow couverts par les tests admin chat tools / controls.",
  },
  {
    id: "admin-create-governance-proposal-draft",
    label: "Create governance proposal draft",
    mode: "admin",
    kind: "write_tool",
    description:
      "Prepare un draft de proposal governance via confirmation humaine obligatoire.",
    testPrompt: "Prepare une governance proposal draft pour un changement de parametre.",
    successCriteria:
      "Le systeme demande d'abord une confirmation et n'execute rien automatiquement.",
    initialStatus: "green",
    initialNote:
      "Write tool UI + confirmation flow couverts par les tests admin chat tools / controls.",
  },
];
