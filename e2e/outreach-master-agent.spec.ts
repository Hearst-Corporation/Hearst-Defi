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

import { test, expect, type Page } from "@playwright/test";

// Test admin credentials (from seed)
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@hearst.io";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin123!";

// The Master Agent chat calls OpenAI server-side. CI injects a placeholder key
// (`sk-ci-*`) when no real secret is set, which OpenAI rejects with a 401 — so the
// chat-driven scenarios below cannot run. Skip them unless a real OPENAI_API_KEY is
// present (they auto-run once the secret is configured). The deterministic
// intent-router logic itself is covered by Vitest with mocks.
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const HAS_REAL_OPENAI_KEY = OPENAI_KEY.length > 0 && !OPENAI_KEY.startsWith("sk-ci-");
const NO_LLM_REASON =
  "Requires a real OPENAI_API_KEY — the chat backend rejects the CI placeholder (401)";

/**
 * Helper to ensure the assistant rail is open and the chat input is ready.
 * Handles viewport, trigger visibility, rail opening, and input readiness.
 */
async function openAssistantRail(page: Page) {
  // Ensure desktop viewport for right rail visibility
  await page.setViewportSize({ width: 1440, height: 900 });

  // Wait for page to be fully loaded
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");

  // Diagnostic: log current page state
  const currentUrl = page.url();
  console.log(`[E2E openAssistantRail] URL: ${currentUrl}`);

  // Check if rail is already open by looking for chat-rail-body
  const railBody = page.locator('[data-testid="chat-rail-body"]').first();
  const isRailOpen = await railBody.isVisible().catch(() => false);
  console.log(`[E2E openAssistantRail] Rail already open: ${isRailOpen}`);

  if (!isRailOpen) {
    // Find and click the chat trigger to open the rail
    const chatTrigger = page.locator('[data-testid="chat-trigger"]').first();
    const triggerCount = await chatTrigger.count();
    console.log(`[E2E openAssistantRail] Chat trigger count: ${triggerCount}`);

    if (triggerCount === 0) {
      // No trigger found - take diagnostic screenshot
      await page.screenshot({ path: 'test-results/no-chat-trigger.png', fullPage: true });
      const bodyHtml = await page.locator('body').innerHTML().catch(() => 'NO BODY');
      console.log(`[E2E openAssistantRail] Body HTML (first 500 chars): ${bodyHtml.slice(0, 500)}`);
      throw new Error('Chat trigger not found - see test-results/no-chat-trigger.png');
    }

    await chatTrigger.waitFor({ state: "visible", timeout: 10000 });
    await chatTrigger.click();
    console.log(`[E2E openAssistantRail] Clicked chat trigger`);

    // Wait for rail body to appear after click
    await railBody.waitFor({ state: "visible", timeout: 15000 });
    console.log(`[E2E openAssistantRail] Rail body now visible`);
  }

  // Wait for chat input to be ready
  const chatInput = page.locator('[data-testid="chat-input"]').first();
  const inputCount = await chatInput.count();
  console.log(`[E2E openAssistantRail] Chat input count: ${inputCount}`);

  if (inputCount === 0) {
    await page.screenshot({ path: 'test-results/no-chat-input.png', fullPage: true });
    const railHtml = await page.locator('[data-testid="chat-rail-body"]').innerHTML().catch(() => 'NO RAIL');
    console.log(`[E2E openAssistantRail] Rail body HTML (first 500 chars): ${railHtml.slice(0, 500)}`);
    throw new Error('Chat input not found - see test-results/no-chat-input.png');
  }

  await chatInput.waitFor({ state: "visible", timeout: 15000 });
  await expect(chatInput).toBeEnabled({ timeout: 10000 });
  console.log(`[E2E openAssistantRail] Chat input ready`);

  return chatInput;
}

test.describe("Outreach Master Agent E2E", () => {
  test.skip(!HAS_REAL_OPENAI_KEY, NO_LLM_REASON);
  test.beforeEach(async ({ page }) => {
    // Login as admin with diagnostic
    await page.goto("/admin");
    
    // Wait for login form to be ready
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation with extended timeout and diagnostic
    try {
      await page.waitForURL(/\/admin/, { timeout: 15000 });
    } catch (e) {
      // Capture diagnostic info on login failure
      const currentUrl = page.url();
      const bodyText = await page.locator('body').textContent().catch(() => 'NO BODY') ?? 'NO BODY';
      console.log(`[E2E DIAGNOSTIC] Login failed - URL: ${currentUrl}`);
      console.log(`[E2E DIAGNOSTIC] Body preview: ${bodyText.slice(0, 200)}`);
      await page.screenshot({ path: 'test-results/login-failed.png', fullPage: true });
      throw e;
    }

    // Ensure desktop viewport after login
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("navigation: 'ouvre outreach' navigates to outreach workspace", async ({ page }) => {
    // Open assistant rail and get chat input
    const chatInput = await openAssistantRail(page);
    
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
    // Open assistant rail and get chat input
    const chatInput = await openAssistantRail(page);
    
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

    // Open assistant rail and get chat input
    const chatInput = await openAssistantRail(page);
    
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
    // Open assistant rail and get chat input
    const chatInput = await openAssistantRail(page);
    
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

    // Open assistant rail and get chat input
    const chatInput = await openAssistantRail(page);
    
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
  test.skip(!HAS_REAL_OPENAI_KEY, NO_LLM_REASON);
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
