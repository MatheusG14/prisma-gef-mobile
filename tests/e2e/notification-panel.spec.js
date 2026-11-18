const { test, expect } = require('@playwright/test');

test('notification control opens and closes the notification center', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PrismaNavbar && window.PrismaNotifications);
  await page.waitForFunction(() => document.getElementById('loginModal')?.style.display === 'flex');
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

  const button = page.locator('#notificationBtn');
  const panel = page.locator('#notificationsPanel');
  await button.click();

  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('aria-hidden', 'false');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await panel.locator('.notifications-close').click();
  await expect(panel).toBeHidden();
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  for (const width of [320, 390, 600, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      const notificationPanel = document.querySelector('#notificationsPanel');
      notificationPanel.hidden = false;
      notificationPanel.classList.add('open');
      notificationPanel.setAttribute('aria-hidden', 'false');
    });

    const layout = await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        documentWidth: document.documentElement.scrollWidth
      };
    });
    expect(layout.left, `notification panel left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
    expect(layout.right, `notification panel right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    expect(layout.scrollWidth, `notification panel content at ${width}px`).toBeLessThanOrEqual(layout.clientWidth + 2);
    expect(layout.documentWidth, `page width with notifications at ${width}px`).toBeLessThanOrEqual(width + 2);

    await page.evaluate(() => {
      const notificationPanel = document.querySelector('#notificationsPanel');
      notificationPanel.hidden = true;
      notificationPanel.classList.remove('open');
      notificationPanel.setAttribute('aria-hidden', 'true');
    });
  }
});
