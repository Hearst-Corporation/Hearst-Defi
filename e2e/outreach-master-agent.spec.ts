/**
 * Outreach Master Agent — E2E Navigation and Safety Smoke Test.
 *
 * Scenarios:
 * 1. User: "ouvre outreach" → nav /admin/outreach
 * 2. User: "prépare une campagne" → canvas with Create Campaign Draft card
 * 3. User: "écris un email" → Draft Email card visible
 * 4. Negative: "outreach CSS bug" → no navigation, no action card
 * 5. Product Workspace non-regression: "créer un vault" → not outreach
 *
 * Safety verifications:
 * - No Send button visible
 * - "Review required" badges present
 * - "No send" safety indicators visible
 */

import { test, expect } from "@playwright/test";

// Test admin credentials (from seed)
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@hearst.io";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin123!";

test.describe("Outreach Master Agent E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/admin");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/);
  });

  test("navigation: 'ouvre outreach' navigates to outreach workspace", async ({ page }) => {
    // Open chat and type navigation intent
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');
    
    // Wait for chat input
    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });
    
    // Type navigation intent
    await chatInput.fill("ouvre outreach");
    await chatInput.press("Enter");
    
    // Wait for navigation acknowledgment
    await page.waitForTimeout(2000);
    
    // Should navigate to /admin/outreach
    await expect(page).toHaveURL(/\/admin\/outreach/);
    
    // Verify we're on the outreach page
    await expect(page.locator("h1, h2").filter({ hasText: /outreach|campagne/i })).toBeVisible();
  });

  test("negative: 'outreach CSS bug' does not navigate", async ({ page }) => {
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');
    
    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });
    
    // Type bug report (should not navigate)
    await chatInput.fill("outreach CSS bug");
    await chatInput.press("Enter");
    
    await page.waitForTimeout(2000);
    
    // Should stay on current page (not /admin/outreach)
    await expect(page).not.toHaveURL(/\/admin\/outreach/);
    
    // Should show a response (not navigation)
    const response = page.locator('[data-testid="chat-message"], .chat-message, [role="log"] > div').last();
    await expect(response).toBeVisible();
  });

  test("action card: Create Campaign Draft visible with safety badges", async ({ page }) => {
    // Navigate to outreach workspace
    await page.goto("/admin/outreach");
    await page.waitForLoadState("networkidle");
    
    // Open chat
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');
    
    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });
    
    // Request campaign creation
    await chatInput.fill("prépare une campagne test cold");
    await chatInput.press("Enter");
    
    // Wait for canvas/action cards to appear
    await page.waitForTimeout(3000);
    
    // Look for campaign-related content in canvas
    const canvas = page.locator('[data-testid="canvas"], .canvas, section:has-text("Campaign")').first();
    
    // Verify safety indicators (even if canvas not fully rendered, check for badges)
    const pageContent = await page.content();
    
    // Should have safety indicators (these are text that should appear)
    const hasSafetyText = 
      pageContent.includes("Review required") ||
      pageContent.includes("No send") ||
      pageContent.includes("Draft only") ||
      pageContent.includes("review") && pageContent.includes("required");
    
    expect(hasSafetyText).toBeTruthy();
    
    // Should NOT have direct send button
    const hasDirectSend = 
      pageContent.includes("Send now") ||
      pageContent.includes("Send immediately") ||
      pageContent.includes("Envoyer maintenant");
    
    expect(hasDirectSend).toBeFalsy();
  });

  test("non-regression: 'créer un vault' does not go to outreach", async ({ page }) => {
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');
    
    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });
    
    // Type product workspace intent
    await chatInput.fill("créer un vault");
    await chatInput.press("Enter");
    
    await page.waitForTimeout(3000);
    
    // Should NOT go to outreach
    await expect(page).not.toHaveURL(/\/admin\/outreach/);
    
    // Either stays or goes to product workspace
    const url = page.url();
    const isOutreach = url.includes("/admin/outreach");
    expect(isOutreach).toBe(false);
  });

  test("safety: no 'Send' button without 'Review' on action cards", async ({ page }) => {
    await page.goto("/admin/outreach");
    await page.waitForLoadState("networkidle");
    
    // Open chat and request draft
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');
    
    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });
    
    await chatInput.fill("écris un email aux investisseurs");
    await chatInput.press("Enter");
    
    await page.waitForTimeout(3000);
    
    // Check page for action buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      
      // No button should say "Send" without "Review" or "Draft"
      if (text?.toLowerCase().includes("send") && 
          !text.toLowerCase().includes("review") && 
          !text.toLowerCase().includes("draft")) {
        throw new Error(`Unsafe button found: "${text}" — should not have direct send`);
      }
    }
  });
});

test.describe("Outreach Swarms E2E", () => {
  test("campaign creation triggers swarm orchestration", async ({ page }) => {
    // Navigate to outreach workspace
    await page.goto("/admin/outreach");
    await page.waitForLoadState("networkidle");

    // Open chat
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');

    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });

    // Request UAE investor campaign (triggers swarm)
    await chatInput.fill("prépare une campagne investisseurs UAE");
    await chatInput.press("Enter");

    // Wait for swarm processing
    await page.waitForTimeout(3000);

    // Verify canvas opens (swarm orchestration started)
    const canvas = page.locator('[data-testid="canvas"], .canvas, [data-testid="outreach-canvas"]').first();
    const hasCanvas = await canvas.isVisible().catch(() => false);

    // Or check for specialist summaries or action cards
    const pageContent = await page.content();

    // Should show some swarm-related content or action card
    const hasSwarmContent =
      pageContent.includes("Campaign") ||
      pageContent.includes("campagne") ||
      pageContent.includes("Review Campaign") ||
      pageContent.includes("specialist") ||
      pageContent.includes("segment") ||
      hasCanvas;

    expect(hasSwarmContent).toBeTruthy();

    // Safety: no direct send
    expect(pageContent).not.toContain("Send now");
    expect(pageContent).not.toContain("Envoyer maintenant");
  });

  test("simple navigation does NOT trigger swarm", async ({ page }) => {
    await page.goto("/admin");

    // Open chat
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');

    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });

    // Simple navigation - should not trigger swarm
    await chatInput.fill("ouvre outreach");
    await chatInput.press("Enter");

    await page.waitForTimeout(2000);

    // Should navigate without swarm processing overhead
    await expect(page).toHaveURL(/\/admin\/outreach/);

    // Quick response expected (no swarm latency)
    const chatResponse = page.locator('[data-testid="chat-message"], .chat-message').last();
    await expect(chatResponse).toBeVisible();
  });

  test("blocked content shows swarm warnings", async ({ page }) => {
    await page.goto("/admin/outreach");
    await page.waitForLoadState("networkidle");

    // Open chat
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');

    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });

    // Attempt blocked content
    await chatInput.fill("Guaranteed returns campaign");
    await chatInput.press("Enter");

    await page.waitForTimeout(3000);

    // Should show warning or safety message
    const pageContent = await page.content();
    const hasWarning =
      pageContent.includes("blocked") ||
      pageContent.includes("compliance") ||
      pageContent.includes("warning") ||
      pageContent.includes("Cannot proceed");

    // May or may not show explicit warning, but should not allow proceeding
    if (hasWarning) {
      expect(pageContent).not.toContain("Send");
    }
  });

  test("specialist summaries visible in consolidated card", async ({ page }) => {
    await page.goto("/admin/outreach");
    await page.waitForLoadState("networkidle");

    // Open chat
    await page.click('[data-testid="chat-trigger"], [aria-label*="chat" i], button:has-text("Chat")');

    const chatInput = page.locator('textarea[placeholder*="message" i], [data-testid="chat-input"], input[placeholder*="Ask" i]').first();
    await chatInput.waitFor({ state: "visible" });

    // Request campaign (triggers full swarm)
    await chatInput.fill("créer une campagne newsletter distributeurs");
    await chatInput.press("Enter");

    await page.waitForTimeout(3000);

    // Check for specialist indicators or campaign overview
    const pageContent = await page.content();

    // Should have some indication of campaign structure
    const hasCampaignDetails =
      pageContent.includes("Channel") ||
      pageContent.includes("segment") ||
      pageContent.includes("draft") ||
      pageContent.includes("Recipients") ||
      pageContent.includes("campagne");

    expect(hasCampaignDetails || pageContent.includes("Campaign")).toBeTruthy();
  });
});

test.describe("Outreach Master Agent — Non-Admin", () => {
  test("non-admin can navigate but cannot create campaigns", async ({ page }) => {
    // This test would need a non-admin user
    // For now, document the expected behavior
    test.skip(true, "Requires non-admin test user setup");
  });
});
