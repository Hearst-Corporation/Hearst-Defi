export const CHAT_MODES = ["normal", "review", "admin"] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === "string" && CHAT_MODES.includes(value as ChatMode);
}
