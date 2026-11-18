const { test, expect } = require('@playwright/test');

test('mobile search icon is centered with the sidebar menu button', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({
    content: `
      #mainApp { display: block !important; }
      .login-overlay, .registration-overlay, .welcome-overlay, .lgpd-overlay {
        display: none !important;
        pointer-events: none !important;
      }
    `
  });

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const alignment = await page.evaluate(() => {
      const menu = document.getElementById('mobileMenu').getBoundingClientRect();
      const icon = document.querySelector('#globalSearchToggle svg').getBoundingClientRect();
      const searchBox = document.getElementById('globalSearchBox').getBoundingClientRect();
      return {
        menuCenterY: menu.top + menu.height / 2,
        iconCenterY: icon.top + icon.height / 2,
        menuHeight: menu.height,
        searchBoxHeight: searchBox.height
      };
    });

    expect(Math.abs(alignment.menuCenterY - alignment.iconCenterY), `vertical alignment at ${width}px`)
      .toBeLessThanOrEqual(1);
    expect(alignment.menuHeight, `menu touch target at ${width}px`).toBe(44);
    expect(alignment.searchBoxHeight, `search control height at ${width}px`).toBe(44);

    await page.locator('#globalSearchToggle').click();
    await expect(page.locator('#globalSearchToggle')).toHaveAttribute('aria-expanded', 'true');

    const expandedAlignment = await page.evaluate(() => {
      const menu = document.getElementById('mobileMenu').getBoundingClientRect();
      const toggle = document.getElementById('globalSearchToggle').getBoundingClientRect();
      const icon = document.querySelector('#globalSearchToggle svg').getBoundingClientRect();
      return {
        menuCenterY: menu.top + menu.height / 2,
        toggleCenterY: toggle.top + toggle.height / 2,
        iconCenterY: icon.top + icon.height / 2,
        horizontalGap: toggle.left - menu.right
      };
    });

    expect(Math.abs(expandedAlignment.menuCenterY - expandedAlignment.toggleCenterY), `toggle alignment while open at ${width}px`)
      .toBeLessThanOrEqual(1);
    expect(Math.abs(expandedAlignment.menuCenterY - expandedAlignment.iconCenterY), `icon alignment while open at ${width}px`)
      .toBeLessThanOrEqual(1);
    expect(expandedAlignment.horizontalGap, `search icon remains beside menu at ${width}px`)
      .toBe(12);

    await page.evaluate(() => window.PrismaNavbar.close('search'));
    await expect(page.locator('#globalSearchToggle')).toHaveAttribute('aria-expanded', 'false');
  }
});
