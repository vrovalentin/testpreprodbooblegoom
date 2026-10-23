import { test as base, expect, type Page, type Response } from '@playwright/test';

// Сторонние счётчики и виджеты: на тесты не влияют, только замедляют страницу.
const BLOCKED_HOSTS = [
  'mc.yandex.ru', 'api.mindbox.ru', 'bitrix.info', 'get4click.ru',
  'p.cityadstrack.com', 'x.cnt.my', 'boobl-goom.digift.ru',
];

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).host;
      return BLOCKED_HOSTS.some((h) => host.endsWith(h)) ? route.abort() : route.continue();
    });
    await use(page);
  },
});
export { expect };

/** Открыть страницу; препрод иногда отдаёт 502 или «upstream request failed», тогда повторяем. */
export async function open(page: Page, url: string, attempts = 3): Promise<Response | null> {
  let resp: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const ok = resp && resp.status() < 500 && !(await page.content()).includes('upstream request failed');
    if (ok) break;
  }
  // Даём скриптам Bitrix навесить обработчики.
  await page.waitForTimeout(3000);
  await closePopups(page);
  return resp;
}

/** Закрыть плашку cookie и подтвердить город. */
export async function closePopups(page: Page) {
  const cookie = page.getByRole('button', { name: 'Согласен' });
  if (await cookie.isVisible().catch(() => false)) await cookie.click().catch(() => {});
  const city = page.locator('[data-city-yes]:visible').first();
  if (await city.isVisible().catch(() => false)) await city.click().catch(() => {});
}

/** Число товаров в корзине по счётчику в шапке (0, если счётчика нет). */
export async function headerCartCount(page: Page): Promise<number> {
  const txt = (await page.locator('header a[href="/cart/"], a[href="/cart/"]').first().innerText().catch(() => '')).trim();
  const m = txt.match(/^\d+/);
  return m ? Number(m[0]) : 0;
}

/** Нажать «В корзину» и дождаться ответа сервера add2basket. */
export async function clickAddToCart(page: Page, button = page.locator('[data-add2basket]:visible').first()) {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && (r.request().postData() ?? '').includes('ACTION=add2basket')),
    button.click(),
  ]);
  const body = await resp.json();
  expect(body.STATUS, `add2basket: ${JSON.stringify(body)}`).toBe('OK');
  return body as { ITEM_ID: number; BASKET_QUANTITY: number; BASKET_PRICE: number };
}

// Разделы, где обычно есть товары в наличии во Владивостоке.
export const CATEGORIES = [
  '/igrushki-i-igry/konstruirovanie-i-modelirovanie/',
  '/igrushki-i-igry/konstruirovanie-i-modelirovanie/sbornoe-modelirovanie/',
  '/igrushki-i-igry/igrushechnyy-transport/',
  '/tvorchestvo-razvitie-i-obuchenie/nabory-dlya-tvorchestva/',
];
export const CATALOG_URL = CATEGORIES[0];

/** Открыть раздел, где в листинге есть кнопка «В корзину». */
export async function openCategoryWithStock(page: Page) {
  for (const url of CATEGORIES) {
    await open(page, url);
    const btn = page.locator('.c-items [data-add2basket]:visible').first();
    if (await btn.count()) return btn;
  }
  throw new Error('Не нашёл товар в наличии ни в одном из разделов: ' + CATEGORIES.join(', '));
}

/** Ссылка на товар в наличии (берём из листинга). */
export async function findProductInStock(page: Page): Promise<string> {
  const btn = await openCategoryWithStock(page);
  const href = await btn.getAttribute('href');
  if (!href) throw new Error('У кнопки «В корзину» нет ссылки на товар');
  return href;
}

/** Открыть корзину и дождаться, пока подгрузится список товаров. */
export async function openCart(page: Page) {
  await open(page, '/cart/');
  await expect(page.getByText(/Ваш заказ|Ваша корзина пуста/).first()).toBeVisible({ timeout: 90_000 });
}
