const { test, expect } = require('@playwright/test');

test('education trail renders level progress without runtime errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PrismaNavbar && window.PrismaNotifications);
  await page.waitForFunction(() => document.getElementById('loginModal')?.style.display === 'flex');

  await page.locator('#btnOpenTrilhas').evaluate((element) => element.click());
  const levelProgress = page.locator('#trilhaEduContainer .trilha-level-prog-item');
  await expect(levelProgress).toHaveCount(3);
  await expect(levelProgress.nth(0)).toContainText('Iniciante');
  await expect(levelProgress.nth(1)).toContainText('Intermediário');
  await expect(levelProgress.nth(2)).toContainText('Avançado');
  expect(pageErrors).toEqual([]);
});
