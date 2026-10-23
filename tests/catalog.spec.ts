import { test, expect, open, CATALOG_URL } from './helpers';

const prices = (page) => page.locator('.c-items [itemprop=price]').evaluateAll((es) => es.map((e) => Number(e.getAttribute('content'))));
const titles = (page) => page.locator('.c-items .product-b__title').allInnerTexts();

test.describe('Каталог', () => {
  test('CAT-01/02 раздел и карточки товаров', async ({ page }) => {
    const resp = await open(page, CATALOG_URL);
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toContainText('Конструирование');
    await expect(page.getByText('Главная страница').first()).toBeVisible();
    const cards = page.locator('.c-items [data-entity=item]');
    expect(await cards.count()).toBeGreaterThan(0);
    const card = cards.first();
    await expect(card.locator('.product-b__title')).not.toBeEmpty();
    await expect(card.locator('.price__current')).toBeVisible();
    await expect(card.locator('[data-add2basket], [data-add2waiting]').first()).toBeVisible();
    await expect(card.locator('[data-add2favorites]')).toBeVisible();
  });

  test('CAT-03 сортировка по цене по возрастанию', async ({ page }) => {
    await open(page, CATALOG_URL);
    await page.locator('a[href="?sort=base&order=asc"]:visible').first().click();
    await expect(page).toHaveURL(/sort=base&order=asc/);
    await page.waitForTimeout(2000);
    const p = await prices(page);
    expect(p.length).toBeGreaterThan(1);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  for (const [name, q] of [['Новизна', 'sort=new&order=desc'], ['Скидка', 'sort=discount&order=desc'], ['Популярность', 'sort=popular&order=desc']]) {
    test(`CAT-04 сортировка «${name}»`, async ({ page }) => {
      const resp = await open(page, `${CATALOG_URL}?${q}`);
      expect(resp?.status()).toBeLessThan(400);
      expect(await page.locator('.c-items [data-entity=item]').count()).toBeGreaterThan(0);
    });
  }

  test('CAT-05 вид «список»', async ({ page }) => {
    await open(page, `${CATALOG_URL}?view=list`);
    await expect(page.locator('.c-items').first()).not.toHaveClass(/c-items--grid/);
  });

  test('CAT-06 вторая страница каталога отличается от первой', async ({ page }) => {
    await open(page, CATALOG_URL);
    const first = await titles(page);
    await open(page, `${CATALOG_URL}?PAGEN_1=2`);
    const second = await titles(page);
    expect(second.length).toBeGreaterThan(0);
    expect(second[0]).not.toBe(first[0]);
  });

  test('CAT-07 переход в карточку товара', async ({ page }) => {
    await open(page, CATALOG_URL);
    const link = page.locator('.c-items .product-b__title').first();
    const name = (await link.innerText()).trim();
    await link.click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.locator('h1')).toContainText(name.slice(0, 20));
    await expect(page.getByText(/Код товара/).first()).toBeVisible();
    await expect(page.locator('[data-add2basket], [data-add2waiting]').first()).toBeVisible();
  });
});

test.describe('Фильтры', () => {
  async function applyFilter(page) {
    const apply = page.locator('form[name=elastic_filter] .btn--orange:visible', { hasText: /Показать \d+/ }).first();
    await expect(apply).toBeVisible();
    const n = Number((await apply.innerText()).match(/\d+/)![0]);
    await apply.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    return n;
  }

  test('FLT-01 фильтр по бренду LEGO', async ({ page }) => {
    await open(page, CATALOG_URL);
    await page.locator('label.b-check__label:has(input[name="props[brand]"][value=lego])').click();
    const n = await applyFilter(page);
    expect(n).toBeGreaterThan(0);
    const t = await titles(page);
    expect(t.length).toBeGreaterThan(0);
    for (const title of t) expect(title.toLowerCase(), title).toContain('lego');
  });

  test('FLT-02 фильтр по цене', async ({ page }) => {
    await open(page, CATALOG_URL);
    const min = page.locator('input[name="price[min]"]:visible').first();
    const max = page.locator('input[name="price[max]"]:visible').first();
    await min.fill('500'); await min.press('Tab');
    await max.fill('1500'); await max.press('Tab');
    await applyFilter(page);
    const p = await prices(page);
    expect(p.length).toBeGreaterThan(0);
    for (const v of p) expect(v).toBeGreaterThanOrEqual(500), expect(v).toBeLessThanOrEqual(1500);
  });

  test('FLT-03 наличие в магазине сужает выдачу', async ({ page }) => {
    await open(page, CATALOG_URL);
    const shop = page.locator('label.b-check__label:has(input[name="offers[shops]"])').first();
    const expected = Number(await shop.locator('[data-check-num]').innerText());
    await shop.click();
    const n = await applyFilter(page);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(expected);
    expect(await page.locator('.c-items [data-entity=item]').count()).toBeGreaterThan(0);
  });

  test('FLT-04/06 бренд + цена + сортировка', async ({ page }) => {
    await open(page, CATALOG_URL);
    await page.locator('label.b-check__label:has(input[name="props[brand]"][value=lego])').click();
    const max = page.locator('input[name="price[max]"]:visible').first();
    await max.fill('3000'); await max.press('Tab');
    await applyFilter(page);
    const url = page.url();
    await page.locator('a[href*="sort=base&order=asc"]:visible').first().click();
    await page.waitForTimeout(4000);
    const t = await titles(page);
    const p = await prices(page);
    expect(t.length).toBeGreaterThan(0);
    for (const title of t) expect(title.toLowerCase(), `фильтр сохранился после сортировки (было ${url})`).toContain('lego');
    for (const v of p) expect(v).toBeLessThanOrEqual(3000);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  test('FLT-05 сброс фильтров', async ({ page }) => {
    await open(page, CATALOG_URL);
    const before = await page.locator('.c-items [data-entity=item]').count();
    await page.locator('label.b-check__label:has(input[name="props[brand]"][value=lego])').click();
    await applyFilter(page);
    await page.locator('.filter-m-head__clear, [onclick*="elasticFilter.clear"]').first().click({ force: true });
    await page.waitForTimeout(5000);
    const t = await titles(page);
    expect(t.some((x) => !x.toLowerCase().includes('lego')), 'после сброса в выдаче снова не только LEGO').toBe(true);
    expect(await page.locator('.c-items [data-entity=item]').count()).toBe(before);
  });
});
