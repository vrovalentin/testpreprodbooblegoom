import { test as base, expect, type Page, type Response } from '@playwright/test';

// Сторонние счётчики и виджеты: на тесты не влияют, только замедляют страницу.
const BLOCKED_HOSTS = [
  'mc.yandex.ru', 'api.mindbox.ru', 'bitrix.info', 'get4click.ru',
  'p.cityadstrack.com', 'x.cnt.my', 'boobl-goom.digift.ru',
];

// Заглушка Яндекс SmartCaptcha. Без неё форма входа не работает вообще
// (скрипт сайта выходит, если window.smartCaptcha нет), а пройти настоящую капчу автотест не может.
// Сервер препрода токен капчи не проверяет.
function stubSmartCaptcha() {
  const subs: Record<string, Array<(t: string) => void>> = {};
  let n = 0;
  (window as any).smartCaptcha = {
    render: () => ++n,
    reset: () => {},
    destroy: () => {},
    getResponse: () => 'autotest-token',
    execute: (id: number) => setTimeout(() => (subs[`${id}:success`] ?? []).forEach((f) => f('autotest-token')), 50),
    subscribe: (id: number, ev: string, cb: (t: string) => void) => {
      (subs[`${id}:${ev}`] ??= []).push(cb);
      return () => {};
    },
  };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(stubSmartCaptcha);
    await page.route('**/*', (route) => {
      const req = route.request();
      const host = new URL(req.url()).host;
      if (BLOCKED_HOSTS.some((h) => host.endsWith(h)) || host === 'captcha-api.yandex.ru') return route.abort();
      // Предохранитель: тесты никогда не создают заказ. Запрос сохранения заказа обрываем.
      if (req.url().includes('sale.order.ajax') && /(^|&)soa-action=saveOrderAjax(&|$)/.test(decodeURIComponent(req.postData() ?? ''))) {
        return route.abort();
      }
      return route.continue();
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
    const ok = resp && resp.status() < 500
      && !(await page.content()).includes('upstream request failed')
      && (await page.locator('input.hdr-search__input, h1').count()) > 0;
    if (ok) break;
  }
  // Ждём загрузки скриптов сайта, иначе кнопки ещё не работают.
  await page.waitForLoadState('load', { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await closePopups(page);
  return resp;
}

/** Закрыть плашку cookie. Окно «Вы здесь: город» не трогаем: «Да, верно» перезагружает страницу. */
export async function closePopups(page: Page) {
  const cookie = page.getByRole('button', { name: 'Согласен' });
  if (await cookie.isVisible().catch(() => false)) await cookie.click().catch(() => {});
}

/** Число товаров в корзине по счётчику в шапке (0, если счётчика нет). */
export async function headerCartCount(page: Page): Promise<number> {
  const txt = (await page.locator('header a[href="/cart/"], a[href="/cart/"]').first().innerText().catch(() => '')).trim();
  const m = txt.match(/^\d+/);
  return m ? Number(m[0]) : 0;
}

/** Нажать «В корзину» и дождаться ответа сервера add2basket. */
export async function clickAddToCart(page: Page, button = page.locator('[data-add2basket]:visible').first()) {
  const isAdd = (r: Response) => r.request().method() === 'POST' && (r.request().postData() ?? '').includes('ACTION=add2basket');
  let resp = await Promise.all([page.waitForResponse(isAdd, { timeout: 90_000 }), button.click()]).then(([r]) => r).catch(() => null);
  // Препрод иногда отвечает 502 / не отвечает: одна повторная попытка.
  if (!resp || resp.status() >= 500) {
    [resp] = await Promise.all([page.waitForResponse(isAdd, { timeout: 90_000 }), button.click()]);
  }
  const body = await resp!.json();
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
export async function openCategoryWithStock(page: Page, cityPrefix = '') {
  for (const url of CATEGORIES) {
    await open(page, cityPrefix + url);
    const btn = page.locator('.c-items [data-add2basket]:visible').first();
    if (await btn.count()) return btn;
  }
  throw new Error('Не нашёл товар в наличии ни в одном из разделов: ' + CATEGORIES.join(', '));
}

/** Ссылка на товар в наличии (берём из листинга). */
export async function findProductInStock(page: Page, cityPrefix = ''): Promise<string> {
  const btn = await openCategoryWithStock(page, cityPrefix);
  const href = await btn.getAttribute('href');
  if (!href) throw new Error('У кнопки «В корзину» нет ссылки на товар');
  return href;
}

/** Открыть корзину и дождаться, пока подгрузится список товаров. */
export async function openCart(page: Page) {
  await open(page, '/cart/');
  await expect(page.getByText(/Ваш заказ|Ваша корзина пуста/).first()).toBeVisible({ timeout: 90_000 });
}

export const TEST_USER = {
  login: process.env.TEST_USER_LOGIN ?? '',
  password: process.env.TEST_USER_PASSWORD ?? '',
};
export const hasTestUser = () => Boolean(TEST_USER.login && TEST_USER.password);

/** Открыть окно входа. */
export async function openAuthModal(page: Page) {
  const modal = page.locator('.modal-popup__inner--auth');
  // Окно грузится AJAX-ом, на медленном препроде иногда не открывается: до 3 попыток.
  for (let i = 0; i < 3; i++) {
    await open(page, '/');
    await page.locator('a[href="/include/modals/auth.php"]').first().click();
    if (await modal.locator('#LOGIN').waitFor({ timeout: 45_000 }).then(() => true).catch(() => false)) break;
  }
  await expect(modal.locator('#LOGIN')).toBeVisible();
  return modal;
}

/** Войти по e-mail и паролю. Возвращает текст ответа сервера (успех или ошибка). */
export async function login(page: Page, loginValue = TEST_USER.login, password = TEST_USER.password) {
  let modal = await openAuthModal(page);
  // Поле пароля появляется, только когда скрипты сайта успели загрузиться; иначе открываем окно заново.
  for (let i = 0; i < 3; i++) {
    await modal.locator('label.radio:has([data-check-by-email])').click();
    if (await modal.locator('#PASSWORD').isVisible()) break;
    await page.waitForTimeout(3000);
    if (await modal.locator('#PASSWORD').isVisible()) break;
    modal = await openAuthModal(page);
  }
  await expect(modal.locator('#PASSWORD'), 'поле пароля (нужны загруженные скрипты сайта)').toBeVisible();
  await modal.locator('#LOGIN').pressSequentially(loginValue, { delay: 20 });
  await modal.locator('#PASSWORD').fill(password);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('action=checkPassword'), { timeout: 120_000 }),
    modal.locator('[data-btn-auth]').click(),
  ]);
  const body = await resp.json();
  return { ok: Boolean(body?.data?.SUCCESS_TEXT), error: body?.data?.ERROR as string | undefined, modal };
}

// Города: id из окна выбора города.
export const CITY = { vladivostok: '3040', khabarovsk: '2917' };

/** Сменить город через cookie (как это делает окно выбора города). */
export async function setCity(page: Page, cityId: string) {
  const domain = new URL(process.env.BASE_URL ?? 'https://preprod.boobl-goom.ru').host;
  await page.context().addCookies([{ name: 'GEO_CITY_XML_ID', value: cityId, domain, path: '/' }]);
}

/** Очистить корзину (у тестового аккаунта она хранится между прогонами). */
export async function clearCart(page: Page) {
  await openCart(page);
  if (await page.getByText('Ваша корзина пуста').isVisible().catch(() => false)) return;
  if (!(await page.locator('[data-entity=basket-item-quantity-field]').count())) return;
  await page.getByText('Выбрать всё').first().click();
  await page.getByText('Удалить выбранные').first().click();
  await expect(page.getByText('0 шт.').first()).toBeVisible({ timeout: 60_000 });
}
