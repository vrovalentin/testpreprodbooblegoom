import { test, expect, open, openCart, clickAddToCart, findProductInStock } from './helpers';

const LOGIN = process.env.TEST_USER_LOGIN;
const PASSWORD = process.env.TEST_USER_PASSWORD;

/** Набрать корзину не меньше 1000 ₽ (минимум для заказа 500 ₽, для экспресс-доставки 1000 ₽). */
async function fillCart(page, minSum = 1000) {
  const url = await findProductInStock(page);
  await open(page, url);
  let res = await clickAddToCart(page);
  while (res.BASKET_PRICE < minSum) {
    await open(page, url);
    res = await clickAddToCart(page);
  }
  return res;
}

test.describe('Оформление заказа', () => {
  test('ORD-01 гостя просят авторизоваться', async ({ page }) => {
    await fillCart(page, 500);
    await openCart(page);
    const btn = page.getByRole('button', { name: 'Оформить заказ' });
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(page).toHaveURL(/\/order\//);
    await open(page, page.url());
    await expect(page.getByText('Авторизация').first()).toBeVisible();
    await expect(page.locator('#LOGIN')).toBeVisible();
  });

  test('DLV-03 подсказка про минимальную сумму экспресс-доставки', async ({ page }) => {
    const url = await findProductInStock(page);
    await open(page, url);
    const { BASKET_PRICE } = await clickAddToCart(page);
    test.skip(BASKET_PRICE >= 1000, 'товар дороже 1000 ₽');
    await openCart(page);
    await expect(page.getByText(/Минимальная сумма (для экспресс-доставки - 1 000 ₽|товаров в заказе)/)).toBeVisible();
  });

  // Кейсы ниже ждут тестовый аккаунт. Финальное подтверждение заказа не нажимаем.
  test('ORD-02 / PICK-01 / DLV-01 шаги оформления, самовывоз и доставка', async ({ page }) => {
    test.skip(!LOGIN || !PASSWORD, 'нужен тестовый аккаунт: TEST_USER_LOGIN / TEST_USER_PASSWORD');
    test.fixme(true, 'дописать селекторы после первого входа под тестовым аккаунтом');
  });
});
