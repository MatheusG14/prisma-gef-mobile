const { test, expect } = require('@playwright/test');

test('Prisma AI actions and Finance Center headings keep a responsive layout', async ({ page }) => {
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
    `
  });

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.querySelectorAll('#mainApp .section').forEach((section) => {
        const active = section.id === 'prisma-ai';
        section.classList.toggle('active', active);
        section.style.display = active ? 'block' : 'none';
      });
    });

    const columns = await page.locator('#prisma-ai .ai-smart-actions-grid')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length);
    expect(columns, `Prisma AI action columns at ${width}px`).toBe(
      width <= 600 ? 2 : width <= 900 ? 3 : 5
    );
    if (width <= 600) {
      const aiLayout = await page.locator('#prisma-ai').evaluate((section) => {
        const title = section.querySelector('.ai-title-row h2');
        const grid = section.querySelector('.ai-smart-actions-grid');
        const titleBounds = title.getBoundingClientRect();
        const gridBounds = grid.getBoundingClientRect();
        const lastActionBounds = grid.lastElementChild.getBoundingClientRect();
        return {
          titleWhiteSpace: getComputedStyle(title).whiteSpace,
          titleHeight: titleBounds.height,
          titleLineHeight: parseFloat(getComputedStyle(title).lineHeight),
          actionCenterOffset: Math.abs(
            (lastActionBounds.left + lastActionBounds.width / 2) -
            (gridBounds.left + gridBounds.width / 2)
          )
        };
      });
      expect(aiLayout.titleWhiteSpace, `Prisma AI title wrapping at ${width}px`).toBe('nowrap');
      expect(aiLayout.titleHeight, `Prisma AI title should stay on one line at ${width}px`)
        .toBeLessThanOrEqual(aiLayout.titleLineHeight * 1.1);
      expect(aiLayout.actionCenterOffset, `Final Prisma AI action should be centered at ${width}px`)
        .toBeLessThanOrEqual(1);
    }

    await page.evaluate(() => {
      document.querySelectorAll('#mainApp .section').forEach((section) => {
        const active = section.id === 'centro-financeiro';
        section.classList.toggle('active', active);
        section.style.display = active ? 'block' : 'none';
      });
    });
    await page.locator('#centro-financeiro [data-cf-open="cfModalPlanning"]').click();

    const heading = page.locator('#cfModalPlanning .cf-planning > .cf-section-heading').first();
    await expect(heading).toBeVisible();
    if (width <= 560) {
      const layout = await heading.evaluate((element) => ({
        display: getComputedStyle(element).display,
        width: element.clientWidth,
        childWidths: [...element.children].map((child) => child.getBoundingClientRect().width)
      }));
      expect(layout.display, `Planning heading layout at ${width}px`).toBe('grid');
      expect(
        layout.childWidths.every((childWidth) => childWidth >= layout.width * 0.9),
        `Planning heading children should use the full width at ${width}px`
      ).toBe(true);
    }

    await page.locator('#cfModalPlanning [data-cf-close]').click();
  }
});
