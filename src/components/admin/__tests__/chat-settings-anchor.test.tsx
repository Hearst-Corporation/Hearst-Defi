/**
 * Guard: the cockpit-shell ChatSettings panel must expose the `ct-chat-settings`
 * DS anchor that the admin chat-mode controls portal into.
 *
 * `AdminChatControls` (the Conversation / Review / Admin mode selector) mounts
 * itself via `document.querySelector(".ct-chat-settings")`. If the shared shell's
 * settings panel ever loses that class (e.g. a Tailwind rewrite of ChatSettings),
 * the selector has nowhere to attach and silently vanishes — exactly the
 * regression this test exists to catch. Kept in the app test tree (not the shell)
 * because the vitest glob only runs `.ts` files under cockpit-shell.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatSettings } from "@hearst/cockpit-shell";

describe("ChatSettings — DS anchor for AdminChatControls", () => {
  it("renders the `ct-chat-settings` anchor the mode selector portals into", () => {
    const html = renderToStaticMarkup(<ChatSettings productName="Hearst Yield Vault" />);
    expect(html).toContain("ct-chat-settings");
  });

  it("still renders its three native sections", () => {
    const html = renderToStaticMarkup(<ChatSettings productName="Hearst Yield Vault" />);
    expect(html).toContain("LLM infra");
    expect(html).toContain("Display");
    expect(html).toContain("Product context");
  });
});
