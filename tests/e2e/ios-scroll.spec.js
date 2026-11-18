const { test, expect } = require('@playwright/test');

const sectionIds = [
  'dashboard', 'centro-financeiro', 'receitas', 'despesas', 'contas', 'cartoes',
  'metas', 'investimentos', 'carteira-ativos', 'educacao-financeira', 'relatorios',
  'prisma-ai', 'dados', 'configuracoes', 'admin'
];

test('iOS WebKit can scroll every screen and a long modal', async ({ page }) => {
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

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    for (const sectionId of sectionIds) {
      await page.evaluate((id) => {
        document.querySelectorAll('#mainApp .section').forEach((section) => {
          const active = section.id === id;
          section.classList.toggle('active', active);
          section.style.display = active ? 'block' : 'none';
        });
        window.scrollTo(0, 0);
      }, sectionId);

      const scroll = await page.evaluate((id) => {
        const section = document.getElementById(id);
        const root = document.scrollingElement;
        const ancestors = [];
        for (let element = section; element; element = element.parentElement) {
          ancestors.push(element);
          if (element === document.body) break;
        }
        const hosts = [...new Set([root, ...ancestors].filter((element) => {
          if (!element) return false;
          return element === root || ['auto', 'scroll'].includes(getComputedStyle(element).overflowY);
        }))];
        const bounds = section.getBoundingClientRect();
        const clipped = ['hidden', 'clip'].includes(getComputedStyle(section).overflowY) &&
          section.scrollHeight > section.clientHeight + 2;
        let canScroll = false;

        for (const host of hosts) {
          if (host.scrollHeight <= host.clientHeight + 1) continue;
          const originalTop = host.scrollTop;
          if (host === root) window.scrollTo(0, root.scrollHeight);
          else host.scrollTop = host.scrollHeight;
          canScroll = host.scrollTop > originalTop + 1 ||
            (host === root && window.scrollY > originalTop + 1);
          if (host === root) window.scrollTo(0, originalTop);
          else host.scrollTop = originalTop;
          if (canScroll) break;
        }

        return {
          needsScroll: clipped || bounds.bottom > window.innerHeight + 1,
          canScroll,
          pageRange: root.scrollHeight - root.clientHeight,
          sectionRange: section.scrollHeight - section.clientHeight
        };
      }, sectionId);

      if (scroll.needsScroll) {
        expect(scroll.canScroll, `${sectionId} at ${viewport.width}px: ${JSON.stringify(scroll)}`).toBeTruthy();
      }
    }
  }

  const modalId = 'investimentoModal';
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
    modal.style.display = 'flex';
    return state;
  }, modalId);
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() =>
    document.body.classList.contains('prisma-scroll-locked'))).toBeTruthy();

  const modalScroll = await page.evaluate((id) => {
    const modal = document.getElementById(id);
    const card = modal.querySelector('.modal-card');
    const style = getComputedStyle(card);
    const range = card.scrollHeight - card.clientHeight;
    const initialTop = card.scrollTop;
    card.scrollTop = card.scrollHeight;
    const moved = card.scrollTop > initialTop + 1;
    card.scrollTop = initialTop;
    return { overflowY: style.overflowY, range, moved };
  }, modalId);

  expect(['auto', 'scroll']).toContain(modalScroll.overflowY);
  if (modalScroll.range > 1) expect(modalScroll.moved).toBeTruthy();

  await page.evaluate(({ id, state }) => {
    const modal = document.getElementById(id);
    modal.hidden = state.hidden;
    modal.className = state.className;
    modal.style.display = state.display;
    if (state.ariaHidden === null) modal.removeAttribute('aria-hidden');
    else modal.setAttribute('aria-hidden', state.ariaHidden);
  }, { id: modalId, state: previousState });
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() =>
    document.body.classList.contains('prisma-scroll-locked'))).toBeFalsy();
});
