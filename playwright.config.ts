import { defineConfig, devices } from '@playwright/test';

// Подхватываем логины и пароли из файла .env (он не попадает в git).
try { process.loadEnvFile('.env'); } catch { /* файла нет: берём переменные окружения */ }

// Препрод отвечает медленно (каталог 20–30 с), поэтому таймауты увеличены.
export default defineConfig({
  testDir: './tests',
  timeout: 4 * 60_000,
  expect: { timeout: 30_000 },
  retries: 1,
  workers: 2,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://preprod.boobl-goom.ru',
    // HTTP-авторизация препрода
    httpCredentials: {
      username: process.env.HTTP_USER ?? 'boobl',
      password: process.env.HTTP_PASS ?? 'booblgoom',
    },
    navigationTimeout: 150_000,
    actionTimeout: 60_000,
    screenshot: 'on',
    trace: 'retain-on-failure',
    locale: 'ru-RU',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
