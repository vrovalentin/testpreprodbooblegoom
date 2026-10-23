import {
  test, expect, open, openCart, clickAddToCart, findProductInStock, login, hasTestUser,
  setCity, clearCart, CITY,
} from './helpers';

// Оформление проверяется до последнего шага. Кнопку «Оформить заказ» на шаге оплаты тесты не нажимают,
// а запрос сохранения заказа дополнительно обрывается в helpers.ts.

/** Положить в корзину товар в наличии на сумму от minSum ₽ (товар в текущем городе).
 *  Повторно жать «В корзину» нельзя: после добавления кнопка ведёт в корзину. Поэтому сразу ставим нужное количество. */
async function fillCart(page, minSum = 1000, cityPrefix = '') {
  const url = await findProductInStock(page, cityPrefix);
  await open(page, url);
  const price = Number(await page.locator('[itemprop=offers] [itemprop=price], [itemprop=price]').first().getAttribute('content'));
  const qty = Math.max(1, Math.ceil(minSum / price));
  for (let i = 1; i < qty; i++) await page.locator('[data-quantity-btn-plus]:visible').first().click();
  return clickAddToCart(page);
}

test.describe('Оформление заказа: гость', () => {
  test('ORD-01 гостя просят авторизоваться', async ({ page }) => {
    await fillCart(page, 500);
    await openCart(page);
    const btn = page.getByRole('button', { name: 'Оформить заказ' }).first();
    await expect(btn).not.toHaveClass(/disabled/);
    await btn.click();
    await expect(page).toHaveURL(/\/order\//);
    await open(page, page.url());
    await expect(page.getByText('Авторизация').first()).toBeVisible();
    await expect(page.locator('#LOGIN').first()).toBeVisible();
  });

  test('DLV-03 подсказка про минимальную сумму в корзине', async ({ page }) => {
    const url = await findProductInStock(page);
    await open(page, url);
    const { BASKET_PRICE } = await clickAddToCart(page);
    test.skip(BASKET_PRICE >= 1000, 'товар дороже 1000 ₽');
    await openCart(page);
    await expect(page.getByText(/Минимальная сумма (для экспресс-доставки - 1 000 ₽|товаров в заказе)/).first()).toBeVisible();
  });
});

test.describe('Оформление заказа: тестовый аккаунт', () => {
  // Один аккаунт и одна корзина на все тесты: запускаем по очереди.
  test.describe.configure({ mode: 'serial', timeout: 10 * 60_000 });
  test.skip(() => !hasTestUser(), 'нужен тестовый аккаунт: TEST_USER_LOGIN / TEST_USER_PASSWORD в .env');

  test('ORD-02 / PICK-01 / PICK-02 Хабаровск: самовывоз до шага оплаты', async ({ page }) => {
    await setCity(page, CITY.khabarovsk);
    expect((await login(page)).ok).toBe(true);
    await clearCart(page);
    await fillCart(page, 1000, '/khabarovsk');
    await openCart(page);
    await page.getByRole('button', { name: 'Оформить заказ' }).first().click();
    await expect(page).toHaveURL(/\/order\//);
    await open(page, '/order/');

    // Шаги оформления
    for (const step of ['Корзина', 'Способ доставки', 'Способ оплаты']) await expect(page.getByText(step).first()).toBeVisible();
    await expect(page.getByText('Хабаровск').first()).toBeVisible();

    // PICK-01: список магазинов
    await expect(page.locator('label.check__label', { hasText: 'Самовывоз' })).toBeVisible();
    const stores = page.locator('[data-pick-btn]:visible');
    await expect(stores.first()).toBeVisible();
    expect(await stores.count()).toBeGreaterThan(0);
    await expect(page.getByText(/Все товары в наличии|В наличии \d+ из \d+/).first()).toBeVisible();

    // PICK-02: выбор магазина и переход к оплате
    await stores.first().click();
    await page.locator('[data-pickup-choose]:visible').first().click();
    await expect(page.getByText('СБП').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Оплата картой').first()).toBeVisible();

    // ORD-04: контактные данные подставлены из профиля
    await expect(page.locator('#soa-property-2')).toHaveValue(process.env.TEST_USER_LOGIN!);
    await expect(page.locator('#soa-property-43')).not.toHaveValue('');
    await expect(page.locator('#soa-property-3')).toBeVisible();

    // ORD-03: без подтверждённого телефона заказ не оформить
    await expect(page.locator('#bx-soa-orderSave')).toHaveClass(/disabled/);
  });

  test('DLV-01 / DLV-02 Хабаровск: доставка по адресу, форма адреса', async ({ page }) => {
    await setCity(page, CITY.khabarovsk);
    expect((await login(page)).ok).toBe(true);
    await openCart(page);
    if (await page.getByText('0 шт.').first().isVisible().catch(() => false)) await fillCart(page, 1000, '/khabarovsk');
    await open(page, '/order/');

    await page.locator('label.check__label', { hasText: 'Доставка по адресу' }).click();
    await expect(page.getByText('Адрес доставки').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('.order-address__add:visible').first().click();
    const form = page.locator('form[name=modal_add_delivery_address]');
    await expect(form).toBeVisible();
    for (const id of ['#address', '#flat', '#entrance', '#floor', '#intercom']) await expect(form.locator(id)).toBeVisible();

    // DLV-02: пустой адрес не сохраняется
    await form.getByText('Добавить', { exact: true }).click();
    await expect(form.getByText('Поле обязательно для заполнения, дом должен быть указан')).toBeVisible();
  });

  test('ORD-00 Владивосток: оформление доступно', async ({ page }) => {
    // Сейчас на препроде падает: «Для выбранного региона оформление заказа временно недоступно».
    await setCity(page, CITY.vladivostok);
    expect((await login(page)).ok).toBe(true);
    await clearCart(page);
    await fillCart(page, 1000);
    await open(page, '/order/');
    await expect(page.getByText('Для выбранного региона оформление заказа временно недоступно')).toHaveCount(0);
    await expect(page.getByText('Самовывоз').first()).toBeVisible();
  });
});
