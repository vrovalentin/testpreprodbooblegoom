# Автотесты boobl-goom.ru (preprod)

Playwright + TypeScript. Тест-кейсы, не привязанные к инструменту: [docs/test-cases.md](docs/test-cases.md).

Тесты не подтверждают заказы и не оплачивают: оформление останавливается перед финальной кнопкой.

## Установка (один раз)

Нужны [Node.js](https://nodejs.org/) версии 20.12 или новее (LTS) и [Git](https://git-scm.com/).
Проверить: `node -v` и `git --version` в терминале.

Терминал: на Windows это PowerShell или терминал VS Code, на macOS приложение «Терминал».

```bash
# 1. Скачать репозиторий
git clone https://github.com/vrovalentin/testpreprodbooblegoom.git
cd testpreprodbooblegoom

# 2. Поставить зависимости проекта (Playwright нужной версии)
npm install

# 3. Скачать браузер для тестов
npx playwright install chromium
```

### Логин и пароль тестового аккаунта

Скопируйте `.env.example` в `.env` и впишите значения:

```bash
# Windows (PowerShell)
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

Откройте `.env` в любом редакторе и заполните `TEST_USER_LOGIN` и `TEST_USER_PASSWORD`.
Файл `.env` в git не попадает, пароль останется только у вас.
Без него тесты, где нужен вход, будут пропущены (skipped), остальные пройдут.

## Запуск

### Графический режим (рекомендуется)

```bash
npx playwright test --ui
```

Откроется окно Playwright:
- слева список тестов по файлам; ▶ рядом с тестом или файлом запускает его, ▶ сверху запускает все;
- сверху слева фильтр **Projects**: оставьте галочку только на `desktop` (мобильная версия пока не проверялась);
- клик по тесту показывает шаги, справа «таймлайн» со скриншотом страницы на каждом шаге, вкладки Console / Network / Errors;
- значок глаза включает «watch»: тест перезапускается при сохранении файла.

### Обычный запуск в терминале

```bash
npx playwright test --project=desktop            # все тесты
npx playwright test tests/cart.spec.ts --project=desktop   # один файл
npx playwright test -g "CART-01" --project=desktop         # тест по имени/ID кейса
npx playwright test --project=desktop --headed   # видеть браузер во время прогона
```

### HTML-отчёт

После прогона в терминале:

```bash
npx playwright show-report
```

Откроется страница в браузере: статус каждого теста, скриншоты, у упавших тестов трейс (кнопка Trace, видно каждый шаг).
Отчёт лежит в папке `playwright-report/`, её можно заархивировать и переслать.

### Через VS Code (по желанию)

Поставьте расширение **Playwright Test for VS Code** (Microsoft). Слева появится вкладка с колбой
(Testing): там список тестов с кнопками запуска, галочка **Show browser** показывает браузер.

## Настройки

Переменные окружения (можно в `.env`): `BASE_URL`, `HTTP_USER`, `HTTP_PASS` (HTTP-авторизация препрода), `TEST_USER_LOGIN`, `TEST_USER_PASSWORD`.

Препрод медленный (страница каталога 20–30 с, бывают 502), поэтому таймауты в `playwright.config.ts` увеличены,
а `open()` в `tests/helpers.ts` повторяет запрос при 5xx. Полный прогон занимает около 15 минут.
