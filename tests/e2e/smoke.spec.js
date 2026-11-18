const { test, expect } = require('@playwright/test');

test.describe('Prisma smoke – mobile/tablet', () => {
  test('carrega shell e exibe login ou welcome', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Viewport e meta
    const viewport = await page.evaluate(() => ({
      w: window.innerWidth,
      meta: document.querySelector('meta[name="viewport"]')?.content || ''
    }));
    expect(viewport.meta).toContain('width=device-width');
    expect(viewport.meta).toMatch(/viewport-fit=cover|initial-scale/);

    // Manifest / PWA link
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);

    // Responsive CSS
    const responsive = page.locator('link[href*="responsive.css"]');
    await expect(responsive).toHaveCount(1);

    // Não deve haver scroll horizontal no body em viewports de teste
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);

    // Overlay de login/welcome deve existir no DOM
    const hasAuthUi =
      (await page.locator('#loginOverlay, #welcomeScreen, .login-overlay, .welcome-overlay').count()) > 0;
    expect(hasAuthUi).toBeTruthy();
  });

  test('bottom-nav removida; menu lateral continua disponível no mobile', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const bottomNav = page.locator('#bottomNav, .bottom-nav');
    await expect(bottomNav).toHaveCount(0);
    await expect(page.locator('#mobileMenu')).toHaveCount(1);
    await expect(page.locator('#sidebar [data-section="dashboard"]')).toHaveCount(1);
  });

  test('service worker script acessível', async ({ request, baseURL }) => {
    const res = await request.get(new URL('/sw.js', baseURL).toString());
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/prisma|CACHE|shell/i);
  });
});
