const { test, expect } = require('@playwright/test');

test('investment distribution chart and legend never overlap', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({
    content: `
      #mainApp { display: block !important; }
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
  await page.waitForFunction(() => typeof window.Chart === 'function');
  await page.evaluate(() => {
    const section = document.getElementById('carteira-ativos');
    const canvas = document.getElementById('portfolioChart');
    const legend = document.getElementById('portfolioLegend');
    section.style.display = 'block';
    section.classList.add('active');
    canvas.style.display = 'block';
    legend.innerHTML = `
      <div class="portfolio-legend-item"><span class="portfolio-legend-dot" style="background:#22c55e"></span><span class="portfolio-legend-name">Ações</span><span class="portfolio-legend-value">45%</span></div>
      <div class="portfolio-legend-item"><span class="portfolio-legend-dot" style="background:#3b82f6"></span><span class="portfolio-legend-name">Renda fixa</span><span class="portfolio-legend-value">35%</span></div>
      <div class="portfolio-legend-item"><span class="portfolio-legend-dot" style="background:#a855f7"></span><span class="portfolio-legend-name">Fundos</span><span class="portfolio-legend-value">20%</span></div>
    `;
    window.portfolioLayoutTestChart = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Ações', 'Renda fixa', 'Fundos'],
        datasets: [{
          data: [45, 35, 20],
          backgroundColor: ['#22c55e', '#3b82f6', '#a855f7'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false } }
      }
    });
  });

  for (const width of [320, 390, 768, 860, 861, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        card: bounds('#carteira-ativos .carteira-distribution-card'),
        body: bounds('#carteira-ativos .carteira-distribution-body'),
        chart: bounds('#carteira-ativos .carteira-distribution-body .portfolio-chart-wrap'),
        legend: bounds('#carteira-ativos .carteira-distribution-body .portfolio-legend')
      };
    });
    const overlap = layout.chart.left < layout.legend.right
      && layout.chart.right > layout.legend.left
      && layout.chart.top < layout.legend.bottom
      && layout.chart.bottom > layout.legend.top;

    expect(layout.chart.width, `chart width at ${width}px`).toBeGreaterThan(0);
    expect(layout.legend.height, `legend height at ${width}px`).toBeGreaterThan(0);
    expect(layout.body.left, `distribution body left at ${width}px`).toBeGreaterThanOrEqual(layout.card.left);
    expect(layout.body.right, `distribution body right at ${width}px`).toBeLessThanOrEqual(layout.card.right);
    expect(overlap, `chart/legend overlap at ${width}px`).toBeFalsy();
  }

  await page.evaluate(() => {
    if (window.portfolioLayoutTestChart) window.portfolioLayoutTestChart.destroy();
  });
});
