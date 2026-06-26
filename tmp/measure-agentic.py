#!/usr/bin/env python3
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4105"
VIEWPORTS = [
    ("1536_chat", 1536, 900, True),
    ("1280_chat", 1280, 900, True),
    ("1024", 1024, 900, False),
    ("390", 390, 844, False),
]

JS = """() => {
  const slot = document.querySelector('.admin-doc-shell');
  const obs = document.getElementById('router-observability');
  const trend = document.querySelector('.agentic-obs-trends-module');
  const crew = document.getElementById('crew-simulation');
  const tower = document.querySelector('.agentic-tower');
  const badges = document.querySelectorAll('.ct-badge, [class*="Badge"]').length;
  const body = document.body;
  const html = document.documentElement;
  return {
    url: location.pathname,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    scrollHeight: Math.max(body.scrollHeight, html.scrollHeight),
    contentSlotW: slot ? Math.round(slot.getBoundingClientRect().width) : null,
    towerH: tower ? Math.round(tower.getBoundingClientRect().height) : null,
    obsH: obs ? Math.round(obs.getBoundingClientRect().height) : null,
    trendH: trend ? Math.round(trend.getBoundingClientRect().height) : null,
    crewH: crew ? Math.round(crew.getBoundingClientRect().height) : null,
    badgeCount: badges,
    overflowX: Math.max(body.scrollWidth, html.scrollWidth) > window.innerWidth + 2,
    hasTower: !!tower,
    hasTrendModule: !!trend,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
  };
}"""

results = {"viewports": [], "console_errors": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()
    page.on("console", lambda m: results["console_errors"].append(m.text) if m.type == "error" else None)
    try:
        page.goto(f"{BASE}/api/auth/dev-login", wait_until="domcontentloaded", timeout=15000)
    except Exception:
        pass

    for name, w, h, open_chat in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        page.goto(f"{BASE}/admin/agentic", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector(".agentic-tower, .admin-doc-shell", timeout=15000)
        if open_chat:
            for sel in ['[data-chat-toggle]', 'button[aria-label*="Chat"]', '.ct-rail-right-toggle']:
                loc = page.locator(sel).first
                if loc.count():
                    try:
                        loc.click(timeout=1500)
                        page.wait_for_timeout(300)
                        break
                    except Exception:
                        pass
        row = page.evaluate(JS)
        row["viewport"] = name
        results["viewports"].append(row)

    browser.close()

print(json.dumps(results, indent=2))
