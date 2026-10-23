import { test, expect, open, openAuthModal, login, hasTestUser, TEST_USER } from './helpers';

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
    page.on('request', (r) => { if (/action=check(Password|Phone)/.test(r.url())) sent = true; });
    await modal.getByRole('button', { name: 'Войти' }).click();
    await page.waitForTimeout(2000);
    await expect(modal).toBeVisible();
    expect(sent, 'запрос на вход не должен уходить с пустым логином').toBe(false);
  });

  test('AUTH-03 вход по e-mail и паролю', async ({ page }) => {
    test.skip(!hasTestUser(), 'нужен тестовый аккаунт: TEST_USER_LOGIN / TEST_USER_PASSWORD в .env');
    const res = await login(page);
    expect(res.error, 'сервер не вернул ошибку').toBeUndefined();
    expect(res.ok).toBe(true);
    await open(page, '/');
    await expect(page.locator('a[href="/include/modals/auth.php"]')).toHaveCount(0);
  });

  test('AUTH-04 неверный пароль', async ({ page }) => {
    test.skip(!hasTestUser(), 'нужен тестовый аккаунт: TEST_USER_LOGIN в .env');
    const res = await login(page, TEST_USER.login, 'wrong-password-123');
    expect(res.error).toBe('Неверный логин или пароль.');
    await expect(res.modal.locator('[data-error-form]').first()).toHaveText('Неверный логин или пароль.');
  });

  test('AUTH-05 несуществующий пользователь', async ({ page }) => {
    const res = await login(page, 'autotest-nobody@example.com', 'whatever-123');
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
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
