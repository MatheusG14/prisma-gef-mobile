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

  test('profile dropdown content stays visible on narrow screens', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({
      content: '#mainApp{display:flex!important}.login-overlay,.registration-overlay,.welcome-overlay,.lgpd-overlay{display:none!important;pointer-events:none!important}'
    });
    await page.addStyleTag({
      content: '#profileDropdown{display:block!important;opacity:1!important;visibility:visible!important;transform:none!important}'
    });

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const dropdown = page.locator('#profileDropdown');
      await expect(dropdown).toBeVisible();
      await expect(page.locator('#dropdownEditProfile')).toBeVisible();
      await expect(page.locator('#dropdownLogout')).toBeVisible();

      const layout = await dropdown.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const stats = [...element.querySelectorAll('.dropdown-stat')].map((stat) => {
          const label = stat.querySelector('.dropdown-stat-label').getBoundingClientRect();
          const value = stat.querySelector('.dropdown-stat-value').getBoundingClientRect();
          return {
            labelLeft: label.left,
            labelRight: label.right,
            valueLeft: value.left,
            valueRight: value.right,
            bottom: Math.max(label.bottom, value.bottom),
            top: Math.min(label.top, value.top)
          };
        });
        return {
          left: bounds.left,
          right: bounds.right,
          bottom: bounds.bottom,
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: document.documentElement.clientHeight,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          stats
        };
      });

      expect(layout.left).toBeGreaterThanOrEqual(-1);
      expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      for (const stat of layout.stats) {
        expect(stat.labelLeft).toBeGreaterThanOrEqual(layout.left);
        expect(stat.valueRight).toBeLessThanOrEqual(layout.right);
        expect(stat.bottom - stat.top).toBeLessThan(30);
      }

    }
  });

  test('service worker script acessível', async ({ request, baseURL }) => {
    const res = await request.get(new URL('/sw.js', baseURL).toString());
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/prisma|CACHE|shell/i);
  });
});
