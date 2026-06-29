import { describe, expect, it } from "vitest";
import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";

describe("vault creation tolerates common typos", () => {
  it.each([
    "On va créer un volt",
    "créer un volt",
    "je veux créer un vaul",
    "créer un veault",
  ])('"%s" still opens the Product Workspace', (msg) => {
    expect(classifyProductWorkspaceIntent(msg).shouldOpenProductWorkspace).toBe(true);
  });

  it("the correct spelling is unaffected", () => {
    expect(classifyProductWorkspaceIntent("On va créer un vault").shouldOpenProductWorkspace).toBe(true);
  });

  it("a bare unrelated word does not open the workspace", () => {
    expect(classifyProductWorkspaceIntent("bonjour").shouldOpenProductWorkspace).toBe(false);
  });
});
