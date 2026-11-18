const { test, expect } = require('@playwright/test');

test('dashboard module dialog buttons are fully visible and reachable', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({
    content: `
      #mainApp { display: flex !important; }
      .login-overlay, .registration-overlay, .welcome-overlay, .lgpd-overlay {
        display: none !important;
        pointer-events: none !important;
      }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `
  });

  const modules = [
    ['cashflow', 'modalModuleCashflow'],
    ['distribution', 'modalModuleDistribution'],
    ['monitoring', 'modalModuleMonitoring'],
    ['income-expense', 'modalModuleIncomeExpense']
  ];

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 720 });

    for (const [moduleName, modalId] of modules) {
      await page.locator(`[data-open-module="${moduleName}"]`).evaluate((element) => element.click());
      const modal = page.locator(`#${modalId}`);
      await expect(modal).toBeVisible();

      const buttons = modal.locator('.financial-modal-body button:visible');
      const clippedButtons = await buttons.evaluateAll((elements) =>
        elements
          .filter((element) => element.scrollWidth > element.clientWidth + 2)
          .map((element) => (element.innerText || element.getAttribute('aria-label') || '').trim())
      );
      expect(clippedButtons, `${modalId} at ${width}px`).toEqual([]);

      for (let index = 0; index < await buttons.count(); index += 1) {
        const button = buttons.nth(index);
        await button.scrollIntoViewIfNeeded();
        const fitsModalBody = await button.evaluate((element) => {
          const body = element.closest('.financial-modal-body');
          const buttonRect = element.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();
          return buttonRect.left >= bodyRect.left - 1 &&
            buttonRect.right <= bodyRect.right + 1 &&
            buttonRect.top >= bodyRect.top - 1 &&
            buttonRect.bottom <= bodyRect.bottom + 1;
        });
        expect(fitsModalBody, `${modalId} button ${index} at ${width}px`).toBeTruthy();
      }

      await modal.locator('[data-close-module]').first().evaluate((element) => element.click());
    }
  }
});
