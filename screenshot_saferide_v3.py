import os
from playwright.sync_api import sync_playwright

def take_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1600, 'height': 2400})
        
        file_path = os.path.abspath('saferide-night-guardian-v3.html')
        page.goto(f'file://{file_path}')
        
        page.wait_for_timeout(2000)
        
        screenshot_path = os.path.abspath('saferide-v3-preview.png')
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to: {screenshot_path}")
        
        browser.close()

if __name__ == "__main__":
    take_screenshot()