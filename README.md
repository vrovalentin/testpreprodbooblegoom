# Автотесты boobl-goom.ru (preprod)

Playwright + TypeScript. Тест-кейсы, не привязанные к инструменту: [docs/test-cases.md](docs/test-cases.md).

## Запуск

```bash
npm i
npx playwright install chromium
# тестовый аккаунт препрода (не коммитить!)
export TEST_USER_LOGIN=...
export TEST_USER_PASSWORD=...
npx playwright test --project=desktop
npx playwright show-report
```

Переменные окружения: `BASE_URL`, `HTTP_USER`, `HTTP_PASS` (HTTP-авторизация препрода), `TEST_USER_LOGIN`, `TEST_USER_PASSWORD`.

Препрод медленный (страница каталога 20–30 с, бывают 502), поэтому таймауты в `playwright.config.ts` увеличены, а `open()` в `tests/helpers.ts` повторяет запрос при 5xx.

Тесты не подтверждают заказы и не оплачивают: оформление останавливается перед финальной кнопкой.
