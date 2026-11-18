const { test, expect } = require('@playwright/test');

const sectionIds = [
  'dashboard', 'centro-financeiro', 'receitas', 'despesas', 'contas', 'cartoes',
  'metas', 'investimentos', 'carteira-ativos', 'educacao-financeira', 'relatorios',
  'prisma-ai', 'dados', 'configuracoes', 'admin'
];

const cardSelector = [
  '.card', '.stat-card', '.grand-module-item', '.dashboard-empty', '.edu-dash-card',
  '.edu-portal-card', '.edu-pdf-card', '.invest-card', '.overview-metric-card',
  '.ai-kpi-card', '.ai-chart-card', '.ai-mini-card', '.modal-card', '.education-lesson-card'
].join(',');

async function collectLayoutIssues(page, scopeSelector, screenName, width) {
  return page.evaluate(({ scopeSelector, screenName, width, cardSelector }) => {
    const scope = document.querySelector(scopeSelector);
    if (!scope) return [];

    const issues = [];
    const inHorizontalScroller = (element) => {
      for (let ancestor = element; ancestor && ancestor !== scope; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (['auto', 'scroll'].includes(style.overflowX)) return true;
      }
      return false;
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        element.getClientRects().length > 0;
    };
    const textLabel = (element) =>
      (element.innerText || element.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100);

    if (document.documentElement.scrollWidth > width + 1) {
      issues.push({
        type: 'page-horizontal-overflow',
        element: screenName,
        actual: document.documentElement.scrollWidth,
        expected: width
      });
    }

    for (const button of scope.querySelectorAll('button, [role="button"], a.btn')) {
      if (!visible(button)) continue;
      const bounds = button.getBoundingClientRect();
      if (!inHorizontalScroller(button) && (bounds.left < -1 || bounds.right > width + 1)) {
        issues.push({
          type: 'element-outside-viewport',
          element: button.innerText || button.getAttribute('aria-label') || button.className,
          bounds: [bounds.left, bounds.right],
          screenName,
          width
        });
      }

      const label = (button.innerText || button.getAttribute('aria-label') || '').trim();
      if (button.scrollWidth > button.clientWidth + 2) {
        const buttonStyle = getComputedStyle(button);
        issues.push({
          type: 'button-content-overflow',
          element: label || button.className,
          className: button.className,
          actual: button.scrollWidth,
          expected: button.clientWidth,
          layout: {
            gap: buttonStyle.gap,
            padding: buttonStyle.padding,
            whiteSpace: buttonStyle.whiteSpace,
            children: Array.from(button.children).map((child) => ({
              element: child.tagName.toLowerCase() +
                (child.className ? `.${String(child.className).split(' ')[0]}` : ''),
              width: child.getBoundingClientRect().width,
              scrollWidth: child.scrollWidth,
              text: textLabel(child)
            }))
          },
          screenName,
          width
        });
      }
    }

    for (const card of scope.querySelectorAll(cardSelector)) {
      if (!visible(card)) continue;
      const bounds = card.getBoundingClientRect();
      if (!inHorizontalScroller(card) && (bounds.left < -1 || bounds.right > width + 1)) {
        issues.push({
          type: 'element-outside-viewport',
          element: card.className,
          bounds: [bounds.left, bounds.right],
          screenName,
          width
        });
      }

      const style = getComputedStyle(card);
      const hasScrollableContent = card.querySelector('[style*="overflow"], .table-responsive, .cf-table-wrap');
      if (!hasScrollableContent && ['hidden', 'clip'].includes(style.overflowX) &&
          card.scrollWidth > card.clientWidth + 2) {
        const overflowingChildren = Array.from(card.querySelectorAll('*'))
          .filter((child) => visible(child) && child.scrollWidth > child.clientWidth + 2)
          .slice(0, 5)
          .map((child) => ({
            element: child.tagName.toLowerCase() +
              (child.className ? `.${String(child.className).split(' ')[0]}` : ''),
            actual: child.scrollWidth,
            expected: child.clientWidth,
            text: textLabel(child)
          }));
        issues.push({
          type: 'card-content-clipped',
          element: card.className,
          text: textLabel(card),
          overflowingChildren,
          actual: card.scrollWidth,
          expected: card.clientWidth,
          screenName,
          width
        });
      }
    }

    for (const textElement of scope.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,small,label,td,th')) {
      if (!textElement.textContent.trim() || !visible(textElement) || inHorizontalScroller(textElement)) continue;
      const style = getComputedStyle(textElement);
      const clipsText = ['hidden', 'clip'].includes(style.overflowX) ||
        ['hidden', 'clip'].includes(style.overflowY) || style.whiteSpace === 'nowrap' ||
        style.textOverflow === 'ellipsis';
      if (clipsText && (textElement.scrollWidth > textElement.clientWidth + 2 ||
          textElement.scrollHeight > textElement.clientHeight + 2)) {
        issues.push({
          type: 'text-clipped',
          element: textElement.tagName.toLowerCase() +
            (textElement.className ? `.${String(textElement.className).split(' ')[0]}` : ''),
          text: textLabel(textElement),
          actual: [textElement.scrollWidth, textElement.scrollHeight],
          expected: [textElement.clientWidth, textElement.clientHeight],
          screenName,
          width
        });
      }
    }

    return issues;
  }, { scopeSelector, screenName, width, cardSelector });
}

async function collectTabIssues(page, scopeSelector, screenName, width) {
  const tabs = page.locator(`${scopeSelector} [role="tab"]`);
  const issues = [];

  for (let index = 0; index < await tabs.count(); index += 1) {
    const tab = tabs.nth(index);
    if (!(await tab.isVisible()) || !(await tab.isEnabled())) continue;
    await tab.evaluate((element) => element.click());
    issues.push(...await collectLayoutIssues(page, scopeSelector, screenName, width));
  }

  return issues;
}

async function inspectGlobalPanels(page, width) {
  const issues = [];
  const panels = [
    { menu: 'profile', panel: '#profileDropdown', name: 'global/profileDropdown' },
    { menu: 'notifications', panel: '#notificationsPanel', name: 'global/notificationsPanel' }
  ];

  for (const { menu, panel, name } of panels) {
    await page.evaluate(() => window.PrismaNavbar?.closeAll());
    await page.evaluate((menuName) => window.PrismaNavbar.open(menuName), menu);
    const panelState = await page.locator(panel).evaluate((element) => ({
      activeMenu: window.PrismaNavbar?.activeMenu,
      hidden: element.hidden,
      className: element.className,
      ariaHidden: element.getAttribute('aria-hidden')
    }));
    await expect(
      page.locator(panel),
      `${name} should open: ${JSON.stringify(panelState)}`
    ).toBeVisible();
    issues.push(...await collectLayoutIssues(page, panel, name, width));
    if (panel === '#notificationsPanel') {
      issues.push(...await collectTabIssues(page, panel, name, width));
    }
    await page.evaluate(() => window.PrismaNavbar?.closeAll());
  }

  return issues;
}

async function inspectAiDrawer(page, width) {
  const trigger = page.locator('#aiToggleCockpitBtn');
  await expect(trigger, 'AI cockpit should expose its open control').toBeVisible();
  await trigger.click();
  const drawer = page.locator('#aiCockpitDrawer');
  await expect(drawer, 'AI cockpit should open from its trigger').toBeVisible();
  const issues = await collectLayoutIssues(page, '#aiCockpitDrawer', 'prisma-ai/aiCockpitDrawer', width);
  await trigger.evaluate((element) => element.click());
  await expect(drawer).toBeHidden();
  return issues;
}

async function inspectEducationLesson(page, width) {
  const trilhasTrigger = page.locator('#btnOpenTrilhas');
  await expect(trilhasTrigger, 'education screen should expose the lesson library').toBeVisible();
  await trilhasTrigger.evaluate((element) => element.click());
  const trilhasModal = page.locator('#modalEduTrilhas');
  await expect(trilhasModal, 'lesson library should open from its card').toBeVisible();

  const lessonsTab = page.locator('#tabAulasInterativas');
  await lessonsTab.evaluate((element) => element.click());
  const lessonButton = page.locator('#educacao-financeira [data-open-lesson]').first();
  await expect(lessonButton, 'education screen should render a lesson action').toBeVisible();
  await lessonButton.evaluate((element) => element.click());

  const modal = page.locator('#educationLessonModal');
  await expect(modal, 'lesson action should open its dialog').toBeVisible();
  const issues = await collectLayoutIssues(
    page,
    '#educationLessonModal',
    'educacao-financeira/educationLessonModal',
    width
  );
  await modal.locator('.education-lesson-close').evaluate((element) => element.click());
  await expect(modal).toBeHidden();
  await page.locator('#closeEduTrilhas').evaluate((element) => element.click());
  await expect(trilhasModal).toBeHidden();
  return issues;
}

async function inspectModal(page, modalId, screenName, width) {
  const previousState = await page.evaluate((id) => {
    const modal = document.getElementById(id);
    const state = {
      hidden: modal.hidden,
      className: modal.className,
      display: modal.style.display
    };
    modal.hidden = false;
    modal.classList.add('active', 'show');
    modal.style.display = 'flex';
    return state;
  }, modalId);

  const selector = `#${modalId}`;
  const issues = await collectLayoutIssues(page, selector, screenName, width);
  issues.push(...await collectTabIssues(page, selector, screenName, width));

  await page.evaluate(({ id, state }) => {
    const modal = document.getElementById(id);
    modal.hidden = state.hidden;
    modal.className = state.className;
    modal.style.display = state.display;
  }, { id: modalId, state: previousState });

  return issues;
}

test('screen and dialog text fits buttons, cards, and viewport', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PrismaNavbar && window.PrismaNotifications);
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

  const allIssues = [];
  const widths = process.env.LAYOUT_AUDIT_WIDTHS
    ? process.env.LAYOUT_AUDIT_WIDTHS.split(',').map(Number)
    : testInfo.project.name === 'iOS-WebKit'
      ? [320, 390]
      : [320, 360, 390, 600, 768, 1024, 1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    allIssues.push(...await inspectGlobalPanels(page, width));
    const sectionIdsPresent = await page.evaluate((ids) =>
      ids.filter((id) => document.getElementById(id)), sectionIds);

    for (const sectionId of sectionIdsPresent) {
      await page.evaluate((id) => {
        document.querySelectorAll('#mainApp .section').forEach((section) => {
          const active = section.id === id;
          section.classList.toggle('active', active);
          section.style.display = active ? 'block' : 'none';
        });
      }, sectionId);
      allIssues.push(...await collectLayoutIssues(page, `#${sectionId}`, sectionId, width));
      allIssues.push(...await collectTabIssues(page, `#${sectionId}`, sectionId, width));
      if (sectionId === 'prisma-ai') {
        allIssues.push(...await inspectAiDrawer(page, width));
      }
      if (sectionId === 'educacao-financeira') {
        allIssues.push(...await inspectEducationLesson(page, width));
      }

      const modalIds = await page.locator(`#${sectionId} .modal-overlay, #${sectionId} .financial-module-modal`)
        .evaluateAll((modals) => modals.map((modal) => modal.id).filter(Boolean));
      for (const modalId of modalIds) {
        allIssues.push(...await inspectModal(page, modalId, `${sectionId}/${modalId}`, width));
      }
    }

    const globalModalIds = await page.locator('.modal-overlay, .financial-module-modal')
      .evaluateAll((modals) => modals
        .filter((modal) => !modal.closest('.section') &&
          !['lgpdScreen', 'privacyPolicyModal'].includes(modal.id))
        .map((modal) => modal.id)
        .filter(Boolean));
    for (const modalId of globalModalIds) {
      allIssues.push(...await inspectModal(page, modalId, `global/${modalId}`, width));
    }
  }

  const groupedIssues = Object.values(allIssues.reduce((groups, issue) => {
    const key = `${issue.type}|${issue.screenName}|${issue.width}`;
    if (!groups[key]) groups[key] = { key, count: 0, example: issue };
    groups[key].count += 1;
    return groups;
  }, {}));
  expect(groupedIssues.map(({ key }) => key), JSON.stringify({
    count: allIssues.length,
    groups: groupedIssues.map(({ key, count, example }) => ({
      key, count, element: example.element, text: example.text,
      actual: example.actual, expected: example.expected,
      layout: example.layout,
      overflowingChildren: example.overflowingChildren,
      bounds: example.textBounds || example.bounds,
      container: example.buttonBounds || example.cardBounds
    }))
  }, null, 2)).toEqual([]);
});
