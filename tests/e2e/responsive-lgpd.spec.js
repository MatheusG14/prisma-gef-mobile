const { test, expect } = require('@playwright/test');

test('LGPD confirmation remains reachable on short and wide viewports', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({
    content: `
      #lgpdScreen { display: flex !important; visibility: visible !important; }
      .login-overlay, .registration-overlay, .welcome-overlay {
        display: none !important;
        pointer-events: none !important;
      }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 320, height: 640 },
    { width: 390, height: 667 },
    { width: 390, height: 844 },
    { width: 768, height: 800 },
    { width: 1280, height: 800 }
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const overlay = document.querySelector('#lgpdScreen');
      const container = overlay.querySelector('.lgpd-container');
      const body = container.querySelector('.lgpd-body');
      const button = container.querySelector('#btnConfirmLgpd');
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      };
      return {
        container: rect(container),
        body: {
          ...rect(body),
          scrollHeight: body.scrollHeight,
          clientHeight: body.clientHeight,
          overflowY: getComputedStyle(body).overflowY
        },
        button: rect(button),
        viewportHeight: document.documentElement.clientHeight
      };
    });

    await expect(page.locator('#btnConfirmLgpd')).toBeVisible();
    expect(layout.container.top).toBeGreaterThanOrEqual(0);
    expect(layout.container.bottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.button.top).toBeGreaterThanOrEqual(layout.container.top);
    expect(layout.button.bottom).toBeLessThanOrEqual(layout.container.bottom + 1);
    expect(layout.body.overflowY).toBe('auto');
    expect(layout.body.scrollHeight).toBeGreaterThan(layout.body.clientHeight);

    await page.locator('#lgpdScreen .lgpd-body').evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });
    const scrollTop = await page.locator('#lgpdScreen .lgpd-body').evaluate((body) => body.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  }
});
