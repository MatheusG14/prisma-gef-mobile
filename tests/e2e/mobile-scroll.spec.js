const { test, expect } = require('@playwright/test');

const sectionIds = [
  'dashboard', 'centro-financeiro', 'receitas', 'despesas', 'contas', 'cartoes',
  'metas', 'investimentos', 'carteira-ativos', 'educacao-financeira', 'relatorios',
  'prisma-ai', 'dados', 'configuracoes', 'admin'
];

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 }
];

async function nextFrame(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function measureScroll(page, id, isModal = false) {
  return page.evaluate(({ id, isModal }) => {
    const scope = document.getElementById(id);
    if (!scope) return { missing: true, needsScroll: false, canScroll: true };

    const isScrollable = (element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY);
    const canMove = (element) => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll < 2) return false;
      const originalTop = element.scrollTop;
      if (element === document.scrollingElement) {
        window.scrollTo(0, maxScroll);
      } else {
        element.scrollTop = maxScroll;
      }
      const moved = element.scrollTop > originalTop + 1 ||
        (element === document.scrollingElement && window.scrollY > originalTop + 1);
      if (element === document.scrollingElement) {
        window.scrollTo(0, originalTop);
      } else {
        element.scrollTop = originalTop;
      }
      return moved;
    };

    if (isModal) {
      const surfaces = [
        scope,
        ...scope.querySelectorAll(
          '.modal-card, .modal-container, .modal-content, .edu-large-modal, .financial-modal-dialog, .financial-modal-body'
        )
      ];
      const scrollables = [
        ...new Set(surfaces.filter((element) => isScrollable(element) &&
          element.scrollHeight > element.clientHeight + 1))
      ];
      const scopeBounds = scope.getBoundingClientRect();
      const clippedSurface = surfaces.some((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return ['hidden', 'clip'].includes(style.overflowY) &&
          (element.scrollHeight > element.clientHeight + 2 || bounds.bottom > window.innerHeight + 1);
      });
      return {
        needsScroll: clippedSurface || scrollables.length > 0 ||
          scopeBounds.bottom > window.innerHeight + 1,
        canScroll: scrollables.some(canMove),
        overflowY: getComputedStyle(scope).overflowY,
        scrollables: scrollables.map((element) => ({
          className: String(element.className || ''),
          range: element.scrollHeight - element.clientHeight
        }))
      };
    }

    const ancestors = [];
    for (let element = scope; element; element = element.parentElement) {
      ancestors.push(element);
      if (element === document.body) break;
    }
    const root = document.scrollingElement;
    const scrollables = [
      ...new Set([root, ...ancestors].filter((element) => element &&
        (element === root || isScrollable(element)) &&
        element.scrollHeight > element.clientHeight + 1))
    ];
    const bounds = scope.getBoundingClientRect();
    const scopeStyle = getComputedStyle(scope);
    const clipped = ['hidden', 'clip'].includes(scopeStyle.overflowY) &&
      scope.scrollHeight > scope.clientHeight + 2;
    return {
      needsScroll: clipped || bounds.bottom > window.innerHeight + 1,
      canScroll: scrollables.some(canMove),
      overflowY: scopeStyle.overflowY,
      pageRange: root ? root.scrollHeight - root.clientHeight : 0,
      sectionRange: scope.scrollHeight - scope.clientHeight
    };
  }, { id, isModal });
}

async function inspectTabs(page, scopeId, screenName, width, failures, isModal = false) {
  const tabs = page.locator(`#${scopeId} [role="tab"]`);
  for (let index = 0; index < await tabs.count(); index += 1) {
    const tab = tabs.nth(index);
    if (!(await tab.isVisible()) || !(await tab.isEnabled())) continue;
    await tab.evaluate((element) => element.click());
    const result = await measureScroll(page, scopeId, isModal);
    if (result.needsScroll && !result.canScroll) {
      failures.push({ screenName, width, state: 'tab', result });
    }
  }
}

async function inspectModal(page, modalId, screenName, width, failures) {
  const previousState = await page.evaluate((id) => {
    const modal = document.getElementById(id);
    const state = {
      hidden: modal.hidden,
      className: modal.className,
      display: modal.style.display,
      ariaHidden: modal.getAttribute('aria-hidden')
    };
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active', 'show');
    if (modal.classList.contains('prisma-card-modal-overlay')) modal.classList.add('open');
    modal.style.display = 'flex';
    return state;
  }, modalId);
  await nextFrame(page);

  const result = await measureScroll(page, modalId, true);
  if (result.needsScroll && !result.canScroll) {
    failures.push({ screenName, width, state: 'modal', result });
  }
  await inspectTabs(page, modalId, screenName, width, failures, true);

  await page.evaluate(({ id, state }) => {
    const modal = document.getElementById(id);
    modal.hidden = state.hidden;
    modal.className = state.className;
    modal.style.display = state.display;
    if (state.ariaHidden === null) modal.removeAttribute('aria-hidden');
    else modal.setAttribute('aria-hidden', state.ariaHidden);
  }, { id: modalId, state: previousState });
  await nextFrame(page);
}

test('all screens, tabs, and dialogs scroll when their content exceeds the viewport', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
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

  const failures = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const ids = await page.evaluate((knownIds) =>
      knownIds.filter((id) => document.getElementById(id)), sectionIds);

    for (const sectionId of ids) {
      await page.evaluate((id) => {
        document.querySelectorAll('#mainApp .section').forEach((section) => {
          const active = section.id === id;
          section.classList.toggle('active', active);
          section.style.display = active ? 'block' : 'none';
        });
        window.scrollTo(0, 0);
      }, sectionId);

      const result = await measureScroll(page, sectionId);
      if (result.needsScroll && !result.canScroll) {
        failures.push({ screenName: sectionId, width: viewport.width, state: 'screen', result });
      }
      await inspectTabs(page, sectionId, sectionId, viewport.width, failures);

      const localModalIds = await page.locator(
        `#${sectionId} .modal-overlay, #${sectionId} .financial-module-modal`
      ).evaluateAll((modals) => modals.map((modal) => modal.id).filter(Boolean));
      for (const modalId of localModalIds) {
        await inspectModal(page, modalId, `${sectionId}/${modalId}`, viewport.width, failures);
      }
    }

    const globalModalIds = await page.locator('.modal-overlay, .financial-module-modal')
      .evaluateAll((modals) => modals
        .filter((modal) => !modal.closest('.section') &&
          !['lgpdScreen', 'privacyPolicyModal'].includes(modal.id))
        .map((modal) => modal.id)
        .filter(Boolean));
    for (const modalId of globalModalIds) {
      await inspectModal(page, modalId, `global/${modalId}`, viewport.width, failures);
    }
  }

  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});
