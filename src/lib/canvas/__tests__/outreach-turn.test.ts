/**
 * Deterministic Outreach turn — classifier + canonical template copy (NO LLM).
 *
 * These pin the state-machine decisions and the exact assistant copy so the
 * Outreach setup conversation never depends on the model:
 *   - the canonical opening message is detected by regex (not the LLM);
 *   - a read question does NOT open the workshop;
 *   - the turn-1 question asks for name + kind (cold | newsletter);
 *   - the post-draft copy never announces an automatic action and proposes the
 *     next step UNDER explicit confirmation.
 */

import { describe, expect, it } from "vitest";

import {
  classifyOutreachIntent,
  buildOutreachAskFieldsMessage,
  buildOutreachFieldsAckMessage,
  buildOutreachPostDraftMessage,
} from "@/lib/canvas/outreach-turn";

const CANONICAL =
  "lance une campagne outreach distributeurs institutionnels pour Hearst Yield";
const TURN2 =
  'crée un draft de campagne nommée "Distributeurs Institutionnels Q3", type cold';

describe("classifyOutreachIntent", () => {
  it("detects the canonical opening message and extracts target + product (no LLM)", () => {
    const intent = classifyOutreachIntent(CANONICAL);
    expect(intent.isOutreach).toBe(true);
    expect(intent.target).toBe("distributeurs institutionnels");
    expect(intent.product).toBe("Hearst Yield");
  });

  it("detects a bare 'lance une campagne outreach' with no target/product", () => {
    const intent = classifyOutreachIntent("lance une campagne outreach");
    expect(intent.isOutreach).toBe(true);
    expect(intent.target).toBeUndefined();
    expect(intent.product).toBeUndefined();
  });

  it("treats the turn-2 'crée un draft de campagne …' message as outreach setup", () => {
    expect(classifyOutreachIntent(TURN2).isOutreach).toBe(true);
  });

  it("does NOT open the workshop for a plain read question", () => {
    expect(classifyOutreachIntent("combien de prospects distributeurs avons-nous ?").isOutreach).toBe(false);
    expect(classifyOutreachIntent("c'est quoi l'outreach ?").isOutreach).toBe(false);
    expect(classifyOutreachIntent("liste les prospects tier A").isOutreach).toBe(false);
  });

  it("does NOT treat the action label 'Create campaign draft' as outreach setup (defense vs label leak)", () => {
    expect(classifyOutreachIntent("Create campaign draft").isOutreach).toBe(false);
  });
});

describe("buildOutreachAskFieldsMessage (turn 1 — deterministic question)", () => {
  it("matches the canonical question with target + product", () => {
    const msg = buildOutreachAskFieldsMessage({
      target: "distributeurs institutionnels",
      product: "Hearst Yield",
    });
    expect(msg).toBe(
      "J'ouvre le workspace Outreach pour une campagne ciblant les distributeurs institutionnels autour de Hearst Yield. " +
        "Pour créer le draft, quel nom veux-tu donner à la campagne, et souhaites-tu un type `cold` ou `newsletter` ?",
    );
  });

  it("still asks for name + kind when target/product are unknown", () => {
    const msg = buildOutreachAskFieldsMessage({});
    const lower = msg.toLowerCase();
    expect(lower).toContain("nom");
    expect(lower).toContain("cold");
    expect(lower).toContain("newsletter");
    expect(lower).toContain("workspace outreach");
  });
});

describe("buildOutreachFieldsAckMessage (turn 2 — deterministic ack)", () => {
  it("confirms the name + kind and that nothing is created until confirmation", () => {
    const msg = buildOutreachFieldsAckMessage({
      name: "Distributeurs Institutionnels Q3",
      kind: "cold",
    });
    expect(msg).toContain("Distributeurs Institutionnels Q3");
    expect(msg).toContain("cold");
    expect(msg).toContain("Create campaign draft");
    expect(msg.toLowerCase()).toContain("rien n'est créé tant que tu ne confirmes pas");
    // Never announces an automatic action.
    expect(msg.toLowerCase()).not.toContain("je vais sourcer");
  });
});

describe("buildOutreachPostDraftMessage (post-draft — deterministic, safe)", () => {
  const msg = buildOutreachPostDraftMessage("Distributeurs Institutionnels Q3");

  it("states the draft was created and nothing was sourced/sent", () => {
    expect(msg).toContain("`Distributeurs Institutionnels Q3`");
    expect(msg.toLowerCase()).toContain("statut draft");
    expect(msg.toLowerCase()).toContain("aucun lead n'a été sourcé");
    expect(msg.toLowerCase()).toContain("aucun email");
  });

  it("proposes the sourcing step UNDER explicit confirmation", () => {
    expect(msg.toLowerCase()).toContain("souhaites-tu");
    expect(msg.toLowerCase()).toContain("confirmation explicite");
  });

  it("NEVER announces an automatic action", () => {
    const lower = msg.toLowerCase();
    for (const phrase of [
      "je vais sourcer",
      "nous devons sourcer",
      "je vais le faire maintenant",
      "je source maintenant",
      "je vais envoyer",
    ]) {
      expect(lower).not.toContain(phrase);
    }
  });

  it("never emits a forbidden compliance word", () => {
    const lower = msg.toLowerCase();
    for (const w of ["guarantee", "promise", "certain", "will deliver", "risk-free"]) {
      expect(lower).not.toContain(w);
    }
  });
});
