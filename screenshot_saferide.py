import os
from playwright.sync_api import sync_playwright

def take_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 2000})
        
        # Use absolute path for file:// URL
        file_path = os.path.abspath('saferide-design-system-reference.html')
        page.goto(f'file://{file_path}')
        
        # Wait for any potential CSS/animation
        page.wait_for_timeout(1000)
        
        # Take full page screenshot
        screenshot_path = os.path.abspath('saferide-preview.png')
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to: {screenshot_path}")
        
        browser.close()

if __name__ == "__main__":
    take_screenshot()
