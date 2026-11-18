const { test, expect } = require('@playwright/test');

test('cards stay compact across app screens on mobile and tablet', async ({ page }) => {
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

  const sections = [
    'dashboard', 'centro-financeiro', 'receitas', 'despesas', 'contas', 'cartoes',
    'metas', 'investimentos', 'carteira-ativos', 'educacao-financeira', 'relatorios',
    'prisma-ai', 'dados', 'configuracoes', 'admin'
  ];
  const cardSelector = [
    '.card', '.stat-card', '.grand-module-item', '.dashboard-empty', '.edu-dash-card',
    '.edu-portal-card', '.edu-pdf-card', '.invest-card', '.overview-metric-card',
    '.ai-kpi-card', '.ai-chart-card', '.ai-mini-card'
  ].join(',');

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const measurements = await page.evaluate(({ sections, cardSelector }) => {
      const results = [];
      for (const sectionId of sections) {
        const section = document.getElementById(sectionId);
        if (!section) continue;
        document.querySelectorAll('#mainApp .section').forEach((item) => {
          item.classList.toggle('active', item === section);
          item.style.display = item === section ? 'block' : 'none';
        });
        const cards = Array.from(section.querySelectorAll(cardSelector)).filter((card) => {
          const rect = card.getBoundingClientRect();
          return getComputedStyle(card).display !== 'none' && rect.width > 0;
        });
        results.push({
          sectionId,
          cards: cards.map((card) => ({
            className: card.className,
            padding: Math.max(...['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
              .map((property) => parseFloat(getComputedStyle(card)[property]))),
            left: card.getBoundingClientRect().left,
            right: card.getBoundingClientRect().right
          }))
        });
      }
      return results;
    }, { sections, cardSelector });

    const maxPadding = width <= 380 ? 10.1 : width <= 600 ? 12.1 : 14.1;
    expect(measurements.some(({ cards }) => cards.length > 0)).toBeTruthy();
    for (const { sectionId, cards } of measurements) {
      for (const card of cards) {
        expect(card.padding, `${sectionId} ${card.className} padding at ${width}px`)
          .toBeLessThanOrEqual(maxPadding);
        expect(card.left, `${sectionId} ${card.className} left edge at ${width}px`)
          .toBeGreaterThanOrEqual(-1);
        expect(card.right, `${sectionId} ${card.className} right edge at ${width}px`)
          .toBeLessThanOrEqual(width + 1);
      }
    }
  }
});
