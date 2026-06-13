/**
 * types.ts — Types publics du chat Cockpit.
 *
 * `ChatPersistence` est le point d'extension : les apps qui veulent une
 * persistance Supabase fournissent une implémentation ; sinon le chat reste
 * en mémoire locale.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  charts?: ChatChart[];
}

export type ChatChartKind = "allocation_stack" | "distribution_range" | "stress_corridor";
export type ChatChartStatus = "building" | "ready";

export interface ChatChartSegment {
  label: string;
  value: number;
  color: string;
}

export interface ChatChartPoint {
  label: string;
  value?: number;
  low?: number;
  high?: number;
}

export interface ChatChart {
  id: string;
  kind: ChatChartKind;
  status: ChatChartStatus;
  title: string;
  metric: string;
  note: string;
  provenance: "Estimated";
  progress: number;
  segments?: ChatChartSegment[];
  points?: ChatChartPoint[];
}

/**
 * Persistance optionnelle du chat. Toutes les méthodes sont async pour ne
 * pas bloquer le rendu. Aucune n'est appelée si `persistence` est absent.
 */
export interface ChatPersistence {
  /** Charge l'historique d'une conversation existante. */
  loadMessages(chatId: string): Promise<ChatMessage[]>;
  /** Sauvegarde un message. */
  saveMessage(chatId: string, msg: ChatMessage): Promise<void>;
  /** Crée une nouvelle conversation, retourne l'ID. */
  createChat(): Promise<string>;
}

/**
 * Config passée à `<CockpitShell chatConfig={...}>`.
 * Permet à chaque app d'orienter le chat vers son endpoint custom + d'injecter
 * une persistance + un libellé de contexte produit.
 */
export interface ChatConfig {
  apiEndpoint?: string;
  persistence?: ChatPersistence;
  productContext?: string;
}
