const { test, expect } = require('@playwright/test');

test('monthly report shows calendar months from January through December', async ({ page }) => {
  const chartErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Erro ao inicializar gráfico')) {
      chartErrors.push(message.text());
    }
  });
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
  const reportData = await page.evaluate(() => {
    const report = window.__chartInstances.find((chart) => chart.canvas.id === 'reportChart');
    return {
      labels: report.data.labels,
      datasets: report.data.datasets.map((dataset) => dataset.data)
    };
  });
  const monthAbbreviations = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  expect(reportData.labels).toEqual(monthAbbreviations.map((month) => `${month}/${String(year).slice(-2)}`));
  expect(reportData.datasets).toHaveLength(2);
  expect(reportData.datasets.every((dataset) => dataset.length === 12)).toBeTruthy();
  expect(chartErrors).toEqual([]);
});
