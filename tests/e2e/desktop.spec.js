/**
 * E2E tests for geckoOS desktop (Playwright)
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Wait for boot to complete
  await page.waitForSelector('#gecko-desktop:not([hidden])', { timeout: 10000 });
});

test('desktop loads and shows menubar', async ({ page }) => {
  await expect(page.locator('#menubar')).toBeVisible();
  await expect(page.locator('#menubar-clock')).toBeVisible();
});

test('dock is visible', async ({ page }) => {
  await expect(page.locator('#dock')).toBeVisible();
});

test('spotlight opens with keyboard shortcut', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#spotlight-overlay')).toBeVisible();
  await expect(page.locator('#spotlight-input')).toBeFocused();
});

test('spotlight closes with Escape', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Escape');
  await expect(page.locator('#spotlight-overlay')).not.toBeVisible();
});

test('clicking gecko logo opens menu', async ({ page }) => {
  await page.click('#gecko-menu-btn');
  await expect(page.locator('#gecko-menu-dropdown')).toBeVisible();
});

test('can launch terminal from dock', async ({ page }) => {
  await page.click('.dock-icon[data-app-id="terminal"]');
  await page.waitForSelector('.gecko-window', { timeout: 5000 });
  await expect(page.locator('.gecko-window')).toBeVisible();
});

test('window has traffic light buttons', async ({ page }) => {
  await page.click('.dock-icon[data-app-id="terminal"]');
  await page.waitForSelector('.window-controls');
  await expect(page.locator('.tl-close')).toBeVisible();
  await expect(page.locator('.tl-minimize')).toBeVisible();
  await expect(page.locator('.tl-maximize')).toBeVisible();
});

test('window close button works', async ({ page }) => {
  await page.click('.dock-icon[data-app-id="terminal"]');
  await page.waitForSelector('.gecko-window');
  await page.click('.tl-close');
  await page.waitForSelector('.gecko-window', { state: 'detached', timeout: 2000 });
  await expect(page.locator('.gecko-window')).toHaveCount(0);
});
