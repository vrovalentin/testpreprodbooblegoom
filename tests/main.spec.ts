import { test, expect, open } from './helpers';

test.describe('Главная', () => {
  test('MAIN-01 главная открывается, шапка и подвал на месте', async ({ page }) => {
    const resp = await open(page, '/');
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Бубль-Гум/);
    await expect(page.locator('input.hdr-search__input')).toBeVisible();
    await expect(page.locator('a[href="/cart/"]').first()).toBeVisible();
    await expect(page.getByText('Личный кабинет').first()).toBeVisible();
    await expect(page.getByText(/Интернет-магазин детских товаров — «Бубль-Гум»/)).toBeAttached();
  });

  test('MAIN-02 основные блоки главной', async ({ page }) => {
    await open(page, '/');
    for (const title of ['Популярные категории', 'Бренды', 'Статьи']) {
      await expect(page.getByText(title, { exact: true }).first(), `блок «${title}»`).toBeAttached();
    }
  });

  test('MAIN-03 меню каталога ведёт в раздел', async ({ page }) => {
    await open(page, '/');
    await page.getByText('Каталог', { exact: true }).first().click();
    const link = page.locator('a[href="/igrushki-i-igry/konstruirovanie-i-modelirovanie/"]:visible').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/konstruirovanie-i-modelirovanie/);
    await expect(page.locator('[data-entity=item]').first()).toBeVisible();
  });

  for (const [name, url] of [
    ['Оплата и доставка', '/customers/delivery-and-payment/'],
    ['Магазины', '/customers/shops/'],
    ['Контакты', '/about/contacts/'],
  ]) {
    test(`MAIN-05 страница «${name}» открывается`, async ({ page }) => {
      const resp = await open(page, url);
      expect(resp?.status()).toBeLessThan(400);
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }
});
