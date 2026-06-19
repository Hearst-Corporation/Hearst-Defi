const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.goto('http://localhost:4105/debug/module-layout');
  // Wait for animations to settle
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'portfolio_qa_v1.png', fullPage: true });
  await browser.close();
})();
