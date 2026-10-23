import {
  test, expect, open, openCart, clickAddToCart, headerCartCount,
  openCategoryWithStock, findProductInStock,
} from './helpers';

test.describe('Добавление в корзину', () => {
  test('CART-01 из листинга каталога', async ({ page }) => {
    const btn = await openCategoryWithStock(page);
    const before = await headerCartCount(page);
    const res = await clickAddToCart(page, btn);
    expect(res.BASKET_QUANTITY).toBe(1);
    await expect.poll(() => headerCartCount(page)).toBe(before + 1);
  });

  test('CART-02/05 из карточки товара, 2 шт.', async ({ page }) => {
    const url = await findProductInStock(page);
    await open(page, url);
    await page.locator('[data-quantity-btn-plus]:visible').first().click();
    const res = await clickAddToCart(page);
    expect(res.QUANTITY).toBe(2);
    await expect(page.locator('[data-add2basket]:visible').first()).toContainText('В корзин');
    await openCart(page);
    await expect(page.locator('[data-entity=basket-item-quantity-field]').first()).toHaveValue('2');
  });

  test('CART-03 из результатов поиска', async ({ page }) => {
    // Берём название товара в наличии и ищем его.
    const url = await findProductInStock(page);
    await open(page, url);
    const name = (await page.locator('h1').innerText()).trim();
    await page.locator('input.hdr-search__input').fill(name);
    await page.locator('input.hdr-search__input').press('Enter');
    await expect(page).toHaveURL(/\/search\//);
    const btn = page.locator('.c-items [data-add2basket]:visible').first();
    await expect(btn).toBeVisible();
    await clickAddToCart(page, btn);
    await expect.poll(() => headerCartCount(page)).toBe(1);
  });

  test('CART-04 из избранного', async ({ page }) => {
    await openCategoryWithStock(page);
    const card = page.locator('.c-items [data-entity=item]').filter({ has: page.locator('[data-add2basket]') }).first();
    await card.locator('[data-add2favorites]').click();
    await page.waitForTimeout(3000);
    await open(page, '/personal/favorites/');
    const favBtn = page.locator('[data-add2basket]:visible').first();
    await expect(favBtn, 'товар появился в избранном и его можно купить').toBeVisible();
    await clickAddToCart(page, favBtn);
    await expect.poll(() => headerCartCount(page)).toBe(1);
  });

  test('CART-06 товар не в наличии нельзя добавить', async ({ page }) => {
    await openCategoryWithStock(page);
    const card = page.locator('.c-items [data-entity=item]').filter({ has: page.locator('[data-add2waiting]') }).first();
    await expect(card.getByText('Сообщить о поступлении')).toBeVisible();
    await expect(card.locator('[data-add2basket]')).toHaveCount(0);
  });
});

test.describe('Корзина', () => {
  test('CART-07/08/11 страница корзины, количество, сохранение после перезагрузки', async ({ page }) => {
    const btn = await openCategoryWithStock(page);
    const { BASKET_PRICE } = await clickAddToCart(page, btn);
    await openCart(page);
    await expect(page.getByText('Ваш заказ').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Оформить заказ' })).toBeVisible();
    const qty = page.locator('[data-entity=basket-item-quantity-field]').first();
    await expect(qty).toHaveValue('1');

    await page.locator('[data-entity=basket-item-quantity-plus]').first().click();
    await expect(qty).toHaveValue('2');
    await expect(page.getByText('2 шт.')).toBeVisible();
    const total = (BASKET_PRICE * 2).toFixed(2).split('.')[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    await expect(page.getByText(/Итого:/)).toContainText(total);

    await page.locator('[data-entity=basket-item-quantity-minus]').first().click();
    await expect(qty).toHaveValue('1');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-entity=basket-item-quantity-field]').first()).toHaveValue('1', { timeout: 90_000 });
  });

  test('CART-09 удаление товара', async ({ page }) => {
    const btn = await openCategoryWithStock(page);
    await clickAddToCart(page, btn);
    await openCart(page);
    await page.getByText('Выбрать всё').click();
    await page.getByText('Удалить выбранные').click();
    await expect(page.getByText(/был удален из корзины/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Восстановить').first()).toBeVisible();
    await expect(page.getByText('0 шт.').first()).toBeVisible();
  });

  test('CART-10 минимальная сумма заказа 500 ₽', async ({ page }) => {
    const btn = await openCategoryWithStock(page);
    const { BASKET_PRICE } = await clickAddToCart(page, btn);
    test.skip(BASKET_PRICE >= 500, `товар стоит ${BASKET_PRICE} ₽, проверка суммы < 500 ₽ невозможна`);
    await openCart(page);
    await expect(page.getByRole('button', { name: 'Оформить заказ' }).first()).toHaveClass(/disabled/);
    await expect(page.getByText('Минимальная сумма товаров в заказе - 500 ₽').first()).toBeVisible();
  });
});
