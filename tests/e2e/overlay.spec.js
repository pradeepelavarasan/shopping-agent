import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Shopping Agent Extension E2E', () => {
  let browserContext;
  let page;
  const extensionPath = path.resolve(__dirname, '../../');

  test.beforeEach(async () => {
    // Load the extension in Chromium
    browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    page = await browserContext.newPage();
  });

  test.afterEach(async () => {
    await browserContext.close();
  });

  test('should inject overlay on an Amazon-like page', async () => {
    // Navigate to a page that matches our host permissions (or a mock one)
    await page.goto('https://www.amazon.com/dp/B000000000');
    
    // In a real test, we would trigger the browser action.
    // Since Playwright doesn't have a direct "click extension icon" API easily for service workers,
    // we can simulate the message that background.js sends or just check if our script is injectable.
    
    // For this regression test, we'll verify the Content Script injection logic.
    await page.evaluate(() => {
        // Mock the chrome.runtime.getURL
        window.chrome = window.chrome || {};
        window.chrome.runtime = {
            getURL: (path) => path,
            onMessage: { addListener: () => {} },
            sendMessage: () => {}
        };
    });

    // Manually inject overlay.js and check if it renders
    await page.addScriptTag({ path: path.resolve(__dirname, '../../overlay.js') });

    const host = page.locator('#shopping-agent-host');
    await expect(host).toBeAttached();

    // Check if the shadow root contains our main container
    const container = page.locator('#shopping-agent-host >> internal:control=shadow-root >> #shopping-agent-container');
    await expect(container).toBeVisible();
  });

  test('should minimize to floater on backdrop click (Amazon domain)', async () => {
    await page.goto('https://www.amazon.com/dp/B000000000');
    await page.addScriptTag({ path: path.resolve(__dirname, '../../overlay.js') });

    // Click backdrop
    const backdrop = page.locator('#shopping-agent-host >> internal:control=shadow-root >> #sa-backdrop');
    await backdrop.click({ force: true });

    // Container should have minimized class
    const container = page.locator('#shopping-agent-host >> internal:control=shadow-root >> #shopping-agent-container');
    await expect(container).toHaveClass(/minimized/);

    // Floater should be visible
    const floater = page.locator('#shopping-agent-host >> internal:control=shadow-root >> #sa-floater');
    await expect(floater).toBeVisible();
  });
});
