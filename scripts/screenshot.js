const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1024 });
  await page.goto('http://localhost:4105/portfolio', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'portfolio-screenshot.png', fullPage: true });
  await browser.close();
})();
