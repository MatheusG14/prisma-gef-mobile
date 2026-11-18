const { test, expect } = require('@playwright/test');

test('monthly report shows calendar months from January through December', async ({ page }) => {
  await page.route('**/chart.umd.min.js*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__chartInstances = [];
        window.Chart = class {
          constructor(context, config) {
            this.canvas = context.canvas;
            this.data = config.data;
            this.options = config.options;
            window.__chartInstances.push(this);
          }
          destroy() {}
          resize() {}
          update() {}
        };
      `
    })
  );
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() =>
    page.evaluate(() => window.__chartInstances?.some((chart) => chart.canvas.id === 'reportChart'))
  ).toBeTruthy();

  const year = await page.evaluate(() => new Date().getFullYear());
  const labels = await page.evaluate(() =>
    window.__chartInstances.find((chart) => chart.canvas.id === 'reportChart').data.labels
  );
  const monthAbbreviations = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  expect(labels).toEqual(monthAbbreviations.map((month) => `${month}/${String(year).slice(-2)}`));
});
