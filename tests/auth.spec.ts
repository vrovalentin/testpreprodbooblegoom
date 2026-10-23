import { test, expect, open } from './helpers';

const LOGIN = process.env.TEST_USER_LOGIN;
const PASSWORD = process.env.TEST_USER_PASSWORD;

async function openAuthModal(page) {
  await open(page, '/');
  await page.locator('a[href="/include/modals/auth.php"]').first().click();
  const modal = page.locator('.modal-popup__inner--auth');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('Авторизация', () => {
  test('AUTH-01 окно входа', async ({ page }) => {
    const modal = await openAuthModal(page);
    await expect(modal.getByText('Авторизация')).toBeVisible();
    await expect(modal.locator('#LOGIN')).toBeVisible();
    await expect(modal.getByText('Войти с помощью кода из SMS')).toBeVisible();
    await expect(modal.getByText('Войти с помощью пароля')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Войти' })).toBeVisible();
    await expect(modal.getByText('Регистрация')).toBeVisible();
    await expect(modal.getByText('Забыли пароль?')).toBeVisible();
  });

  test('AUTH-02 пустая форма не отправляется', async ({ page }) => {
    const modal = await openAuthModal(page);
    let sent = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/include/modals/auth.php')) sent = true; });
    await modal.getByRole('button', { name: 'Войти' }).click();
    await page.waitForTimeout(2000);
    await expect(modal).toBeVisible();
    expect(sent, 'запрос на вход не должен уходить с пустым логином').toBe(false);
  });

  test('AUTH-03 вход по e-mail и паролю', async ({ page }) => {
    test.skip(!LOGIN || !PASSWORD, 'нужен тестовый аккаунт: TEST_USER_LOGIN / TEST_USER_PASSWORD');
    const modal = await openAuthModal(page);
    await modal.locator('#LOGIN').fill(LOGIN!);
    await modal.locator('label.radio:has([data-check-by-email])').click();
    await modal.locator('#PASSWORD').fill(PASSWORD!);
    await modal.getByRole('button', { name: 'Войти' }).click();
    await expect(modal).toBeHidden();
    await expect(page.locator('a[href="/include/modals/auth.php"]')).toHaveCount(0);
  });

  test('AUTH-04 неверный пароль', async ({ page }) => {
    test.skip(!LOGIN, 'нужен тестовый аккаунт: TEST_USER_LOGIN');
    const modal = await openAuthModal(page);
    await modal.locator('#LOGIN').fill(LOGIN!);
    await modal.locator('label.radio:has([data-check-by-email])').click();
    await modal.locator('#PASSWORD').fill('wrong-password-123');
    await modal.getByRole('button', { name: 'Войти' }).click();
    await expect(modal.locator('[data-error-form]')).not.toBeEmpty();
  });
});

test.describe('Регистрация', () => {
  test('REG-01 форма регистрации', async ({ page }) => {
    const modal = await openAuthModal(page);
    await modal.getByText('Регистрация').click();
    const reg = page.locator('form[name=citfact_registration_ajax_form_modal]');
    await expect(reg).toBeVisible();
    for (const id of ['#PHONE', '#NAME', '#LAST_NAME', '#EMAIL']) await expect(reg.locator(id)).toBeVisible();
    await expect(reg.locator('[data-phone-confirm]')).toBeVisible();
    await expect(reg.getByRole('button', { name: 'Зарегистрироваться' })).toHaveClass(/disabled/);
  });

  test('REG-02 без подтверждения телефона регистрация недоступна', async ({ page }) => {
    const modal = await openAuthModal(page);
    await modal.getByText('Регистрация').click();
    const reg = page.locator('form[name=citfact_registration_ajax_form_modal]');
    await reg.locator('#NAME').fill('Автотест');
    await reg.locator('#LAST_NAME').fill('Проверка');
    await reg.locator('#EMAIL').fill('autotest@example.com');
    await expect(reg.getByRole('button', { name: 'Зарегистрироваться' })).toHaveClass(/disabled/);
  });
});
