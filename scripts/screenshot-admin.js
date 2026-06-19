const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1024 });
  await page.goto('http://localhost:4105/admin/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'admin-dashboard-screenshot.png', fullPage: true });
  await browser.close();
})();
