import { describe, expect, it } from "vitest";

import { shouldSkipChatHydration } from "../useChat";

/**
 * Regression guard for the first-turn assistant-reply drop.
 *
 * Repro (live, admin chat): on the FIRST message of a NEW conversation the
 * server creates the chat mid-stream and returns its id via the `x-chat-id`
 * header. `runTurn` mirrors that into local state with `setChatId`, which fires
 * the hydration effect. Without a guard the effect re-fetched
 * `/api/cockpit-chats/{id}` and `setMessages(loaded)` — but the server had only
 * persisted the USER message at that instant (the assistant reply commits at
 * stream end), so it overwrote the streaming assistant placeholder and the reply
 * never rendered (it WAS generated + saved — visible only after a reload).
 *
 * `shouldSkipChatHydration` makes the effect skip exactly the id the in-flight
 * stream just self-assigned, so the live transcript stays authoritative for that
 * turn while a genuine history-pick (a DIFFERENT id) still hydrates.
 */
describe("shouldSkipChatHydration", () => {
  it("skips when chatId is the id the stream just self-assigned (first-turn race)", () => {
    expect(shouldSkipChatHydration("chat_abc", "chat_abc")).toBe(true);
  });

  it("does NOT skip a history-pick — a different chatId must hydrate from the server", () => {
    expect(shouldSkipChatHydration("chat_history_xyz", "chat_abc")).toBe(false);
  });

  it("does NOT skip when no id was self-assigned (normal mount / history load)", () => {
    expect(shouldSkipChatHydration("chat_abc", null)).toBe(false);
  });

  it("does NOT skip the empty/welcome state (null chatId is handled before the guard)", () => {
    expect(shouldSkipChatHydration(null, null)).toBe(false);
    expect(shouldSkipChatHydration(null, "chat_abc")).toBe(false);
  });
});
