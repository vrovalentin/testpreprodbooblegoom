import { test, expect, open } from './helpers';

const input = (page) => page.locator('input.hdr-search__input');

test.describe('Поиск', () => {
  test('SRCH-01 подсказки при вводе', async ({ page }) => {
    await open(page, '/');
    await input(page).pressSequentially('конструктор', { delay: 50 });
    await expect(page.locator('#search_products_container > *').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-search-header-all-results]')).toBeVisible();
  });

  test('SRCH-02 страница результатов', async ({ page }) => {
    await open(page, '/');
    await input(page).fill('конструктор');
    await input(page).press('Enter');
    await expect(page).toHaveURL(/\/search\//);
    await expect(page.getByText(/По запросу "конструктор" найдено \d+ товар/)).toBeVisible();
    expect(await page.locator('.c-items [data-entity=item]').count()).toBeGreaterThan(0);
  });

  test('SRCH-03 пустой результат', async ({ page }) => {
    await open(page, '/');
    await input(page).fill('qwzxqwzxqwzx');
    await input(page).press('Enter');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/По запросу "qwzxqwzxqwzx" найдено 0 товаров/)).toBeVisible();
  });

  test('SRCH-04 поиск по коду товара', async ({ page }) => {
    await open(page, '/');
    await input(page).fill('333348');
    await input(page).press('Enter');
    await expect(page.locator('.c-items .product-b__title').first()).toContainText('Истребитель');
  });

  test('SRCH-05 запрос в английской раскладке', async ({ page }) => {
    await open(page, '/');
    await input(page).fill('rjycnhernjh');
    await input(page).press('Enter');
    await page.waitForLoadState('domcontentloaded');
    const found = await page.locator('.c-items [data-entity=item]').count();
    const hint = await page.getByText(/Возможно вы имели ввиду/).isVisible().catch(() => false);
    expect(found > 0 || hint, 'должны быть результаты или подсказка «Возможно вы имели ввиду»').toBe(true);
  });

  test('SRCH-06 фильтр категории в результатах', async ({ page }) => {
    await open(page, '/');
    await input(page).fill('конструктор');
    await input(page).press('Enter');
    const total = Number((await page.getByText(/найдено \d+ товар/).innerText()).match(/найдено (\d+)/)![1]);
    const counter = page.waitForResponse((r) => r.url().includes('action=filterButton'), { timeout: 120_000 });
    await page.locator('form[name=elastic_filter] label.b-check__label').first().click();
    await counter;
    const apply = page.locator('[data-total-button]:visible').first();
    const n = Number((await apply.innerText()).match(/\d+/)![0]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);
  });
});
