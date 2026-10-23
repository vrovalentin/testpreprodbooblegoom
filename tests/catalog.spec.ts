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
    await expect(page.locator('a[href="?sort=base&order=asc"]:visible').first()).toBeVisible();
    await open(page, `${CATALOG_URL}?sort=base&order=asc`);
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

// Фильтр применяется AJAX-запросом, а скрипт сайта обрывает его через 10 с.
// Препрод отвечает 20–25 с, поэтому через интерфейс фильтр не применяется (FLT-01 UI).
// Логику фильтрации проверяем по ЧПУ-ссылкам фильтра: /f/brand-is-lego/ и т.п.
test.describe('Фильтры', () => {
  const lego = `${CATALOG_URL}f/brand-is-lego/`;

  test('FLT-01 UI: отметить бренд LEGO и нажать «Показать N товаров»', async ({ page }) => {
    await open(page, CATALOG_URL);
    const counter = page.waitForResponse((r) => r.url().includes('action=filterButton'), { timeout: 120_000 });
    await page.locator('label.b-check__label:has(input[name="props[brand]"][value=lego])').click();
    await counter;
    const apply = page.locator('[data-total-button]:visible').first();
    await expect(apply).toHaveText(/Показать \d+ товар/);
    const n = Number((await apply.innerText()).match(/\d+/)![0]);
    expect(n).toBeGreaterThan(0);
    await apply.click();
    await expect(page, 'фильтр применился: URL /f/brand-is-lego/').toHaveURL(/brand-is-lego/, { timeout: 120_000 });
    for (const title of await titles(page)) expect(title.toLowerCase(), title).toContain('lego');
  });

  test('FLT-01 по ссылке: только LEGO', async ({ page }) => {
    const resp = await open(page, lego);
    expect(resp?.status()).toBeLessThan(400);
    const t = await titles(page);
    expect(t.length).toBeGreaterThan(0);
    for (const title of t) expect(title.toLowerCase(), title).toContain('lego');
    await expect(page.locator('input[name="props[brand]"][value=lego]')).toBeChecked();
  });

  test('FLT-02 по ссылке: цена 500–1500', async ({ page }) => {
    await open(page, `${CATALOG_URL}f/price-from-500-to-1500/`);
    const p = await prices(page);
    expect(p.length).toBeGreaterThan(0);
    for (const v of p) { expect(v).toBeGreaterThanOrEqual(500); expect(v).toBeLessThanOrEqual(1500); }
  });

  test('FLT-03 по ссылке: наличие в магазине «ТЦ Ладыгина»', async ({ page }) => {
    const resp = await open(page, `${CATALOG_URL}f/shop-is-49/`);
    expect(resp?.status(), 'страница фильтра по магазину открывается').toBeLessThan(400);
    expect(await page.locator('.c-items [data-entity=item]').count()).toBeGreaterThan(0);
    await expect(page.locator('input[name="offers[shops]"][value="49"]')).toBeChecked();
  });

  test('FLT-04/06 по ссылке: LEGO + цена до 3000 + сортировка по цене', async ({ page }) => {
    await open(page, `${CATALOG_URL}f/brand-is-lego/price-from-0-to-3000/?sort=base&order=asc`);
    const t = await titles(page);
    const p = await prices(page);
    expect(t.length).toBeGreaterThan(0);
    for (const title of t) expect(title.toLowerCase(), title).toContain('lego');
    for (const v of p) expect(v).toBeLessThanOrEqual(3000);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  test('FLT-05 сброс фильтра', async ({ page }) => {
    await open(page, lego);
    await page.getByText('Сбросить', { exact: true }).locator('visible=true').first().click();
    await expect(page).not.toHaveURL(/brand-is-lego/, { timeout: 120_000 });
    const t = await titles(page);
    expect(t.some((x) => !x.toLowerCase().includes('lego'))).toBe(true);
  });
});
