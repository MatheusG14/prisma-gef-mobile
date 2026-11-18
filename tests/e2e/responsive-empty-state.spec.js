const { test, expect } = require('@playwright/test');

test('financial empty states and budget actions fit all viewport sizes', async ({ page }) => {
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
  await page.evaluate(() => {
    const emptyRow = (message) =>
      `<tr class="empty-row"><td colspan="7"><div class="section-empty"><p>${message}</p></div></td></tr>`;
    const receipts = document.querySelector('#receitasBody');
    const expenses = document.querySelector('#despesasBody');
    if (!receipts.querySelector('.empty-row')) {
      receipts.innerHTML = emptyRow('Nenhuma receita cadastrada. Clique em "Nova Receita" para começar.');
    }
    if (!expenses.querySelector('.empty-row')) {
      expenses.innerHTML = emptyRow('Nenhuma despesa cadastrada. Clique em "Nova Despesa" para começar.');
    }
  });

  const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    for (const section of ['receitas', 'despesas']) {
      await page.evaluate((activeId) => {
        document.querySelectorAll('.section').forEach((item) => {
          item.classList.toggle('active', item.id === activeId);
        });
      }, section);

      const message = page.locator(`#${section} .empty-row .section-empty p`);
      await expect(message).toBeVisible();
      const layout = await message.evaluate((element) => {
        const table = element.closest('table');
        const text = document.createRange();
        text.selectNodeContents(element);
        const rect = element.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        return {
          whiteSpace: getComputedStyle(element).whiteSpace,
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          tableLeft: tableRect.left,
          tableRight: tableRect.right,
          textRects: Array.from(text.getClientRects(), (line) => ({
            left: line.left,
            right: line.right
          })),
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth
        };
      });

      expect(layout.whiteSpace).toBe('normal');
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.left).toBeGreaterThanOrEqual(layout.tableLeft - 1);
      expect(
        layout.right,
        `empty-state text exceeds table at ${width}px: ${JSON.stringify(layout)}`
      ).toBeLessThanOrEqual(layout.tableRight + 1);
      expect(layout.textRects.every((line) =>
        line.left >= layout.left - 1 && line.right <= layout.right + 1
      )).toBeTruthy();
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 2);

      if (section === 'despesas') {
        const applyPlan = page.locator('#budgetApplyPlanBtn');
        await expect(applyPlan).toBeVisible();
        const buttonWidth = await applyPlan.evaluate((element) => ({
          scroll: element.scrollWidth,
          client: element.clientWidth
        }));
        expect(buttonWidth.scroll).toBeLessThanOrEqual(buttonWidth.client + 2);
      }
    }
  }
});
