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

test('descriptive card actions align to the content column at every breakpoint', async ({ page }) => {
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
  await page.evaluate(() => {
    const fixtures = document.createElement('div');
    fixtures.id = 'card-action-layout-fixtures';
    fixtures.innerHTML = `
      <article class="card education-course">
        <div class="education-course-actions">
          <button type="button" class="btn primary">Iniciar aula</button>
          <a class="btn secondary">PDF</a>
          <button type="button" class="btn secondary">E-mail</button>
        </div>
      </article>
      <article class="edu-pdf-card">
        <div class="edu-pdf-badge">PDF 01</div>
        <div class="edu-pdf-info"><h4>Guia</h4><p>Descrição do guia.</p></div>
        <div class="edu-pdf-actions">
          <a class="btn secondary">Baixar</a>
          <button type="button" class="btn secondary">E-mail</button>
        </div>
      </article>
      <article class="card">
        <div class="profile-card-actions">
          <button type="button" class="btn-edit">Entrar</button>
          <button type="button" class="btn-edit">Editar</button>
          <button type="button" class="btn-delete">Excluir</button>
        </div>
      </article>
    `;
    document.getElementById('mainApp').appendChild(fixtures);
  });

  for (const width of [320, 390, 640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const measurements = await page.evaluate(() => {
      const sections = ['centro-financeiro', 'investimentos', 'educacao-financeira'];
      const results = [];

      for (const sectionId of sections) {
        const section = document.getElementById(sectionId);
        if (!section) continue;

        document.querySelectorAll('#mainApp .section').forEach((item) => {
          item.classList.toggle('active', item === section);
          item.style.display = item === section ? 'block' : 'none';
        });

        section.querySelectorAll(
          '.edu-portal-card > .btn, .invest-card-footer > .btn'
        ).forEach((button) => {
          const card = button.closest('.edu-portal-card, .invest-card');
          const cardRect = card.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const style = getComputedStyle(card);
          const borderLeft = parseFloat(style.borderLeftWidth);
          const borderRight = parseFloat(style.borderRightWidth);
          const expectedLeft = cardRect.left + borderLeft + parseFloat(style.paddingLeft);
          const expectedRight = cardRect.right - borderRight - parseFloat(style.paddingRight);

          results.push({
            sectionId,
            button: button.textContent.trim(),
            leftOffset: buttonRect.left - expectedLeft,
            rightOffset: expectedRight - buttonRect.right
          });
        });
      }

      return results;
    });
    const actionGroups = await page.evaluate(() => Array.from(
      document.querySelectorAll(
        '#card-action-layout-fixtures .education-course-actions, ' +
        '#card-action-layout-fixtures .edu-pdf-actions, ' +
        '#card-action-layout-fixtures .profile-card-actions'
      )
    ).map((group) => Array.from(group.children).map((button) => (
      button.getBoundingClientRect().width
    ))));

    expect(measurements.length, `card CTAs at ${width}px`).toBeGreaterThan(0);
    for (const sectionId of ['centro-financeiro', 'investimentos', 'educacao-financeira']) {
      expect(
        measurements.some((measurement) => measurement.sectionId === sectionId),
        `${sectionId} CTA coverage at ${width}px`
      ).toBeTruthy();
    }
    for (const measurement of measurements) {
      expect(measurement.leftOffset, `${measurement.sectionId} ${measurement.button} left at ${width}px`)
        .toBeLessThanOrEqual(1.5);
      expect(measurement.leftOffset, `${measurement.sectionId} ${measurement.button} left at ${width}px`)
        .toBeGreaterThanOrEqual(-1.5);
      expect(measurement.rightOffset, `${measurement.sectionId} ${measurement.button} right at ${width}px`)
        .toBeLessThanOrEqual(1.5);
      expect(measurement.rightOffset, `${measurement.sectionId} ${measurement.button} right at ${width}px`)
        .toBeGreaterThanOrEqual(-1.5);
    }
    for (const widths of actionGroups) {
      expect(widths.length, `card action group at ${width}px`).toBeGreaterThan(1);
      expect(widths.every((buttonWidth) => buttonWidth > 0), `visible buttons at ${width}px`)
        .toBeTruthy();
      expect(Math.max(...widths) - Math.min(...widths), `button widths at ${width}px`)
        .toBeLessThanOrEqual(1.5);
    }
  }
});
