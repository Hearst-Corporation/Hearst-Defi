const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 2500 });
  await page.goto('http://localhost:4105/admin/dashboard');
  // Wait for animations to settle
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'admin_dashboard_after.png', fullPage: true });
  await browser.close();
})();
