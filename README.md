# CoolClean

Сайт: [mazganim-clean-air.gerasim459.workers.dev](https://mazganim-clean-air.gerasim459.workers.dev). Репозиторий: [stackofart/mazganim2](https://github.com/stackofart/mazganim2).

Сайт чистки, дезинфекции и заправки кондиционеров в центральном Израиле. Vue 3 + Vite, готовый HTML на этапе сборки, Cloudflare Workers Static Assets. Без собственного API, базы данных и серверного рендера на запрос. Для обратного звонка используется существующая форма Formspree из референса.

## Данные из референса

Изучен [stackofart/mazganim](https://github.com/stackofart/mazganim), commit `c8a86eebd08f9fc875a120a14e60bccd3aec1956`.

- CoolClean — название из Header, Hero и SEO; одиночное CleanCool в Footer нормализовано.
- Телефон: `054-757-7371` → `+972547577371`.
- Telegram: `https://t.me/IGideonI`.
- География: центральный Израиль, от Ашдода до Хадеры; 12 городов.
- Прайс: 1 / 2 / 3 настенных кондиционера за один визит — 250 / 450 / 600 ₪. Для 4+ блоков, VRF и мультисплит — отдельное согласование. Значение 120 ₪ из неиспользуемого PriceCalculator не перенесено.
- Пять языков: русский `/`, иврит `/he/`, английский `/en/`, арабский `/ar/`, французский `/fr/`. `/ru/` перенаправляет на `/`.
- Formspree: `https://formspree.io/f/mpwrzaby`.

WhatsApp подключён к основному телефону компании: `+972547577371`. Его можно изменить в `company.whatsapp`. `info@example.com` и `t.me/yourusername` не перенесены. Таблица источников и решений: `docs/reference.md`.

## Архитектура

```text
Посетитель → Cloudflare Workers Static Assets → готовый HTML + CSS + Vue
                                             ↘ Formspree: обратный звонок
                                             ↘ телефон / Telegram / WhatsApp
```

Vue отвечает за интерактивность. `@vue/server-renderer` выполняется только при сборке. Скрипт создаёт пять HTML-страниц и удаляет промежуточный SSR-код. Отдельный Worker `fetch` не нужен: Cloudflare обслуживает статику и настоящий 404. Неизвестные URL не возвращают главную страницу.

- `src/App.vue` — состав страницы, навигация, услуги и выбор пакета.
- `src/components/BookingForm.vue` — форма, её состояния и подготовка сообщения.
- `src/data/company.js` — единые контакты, цены, география и endpoint формы.
- `src/data/locales/*.json` — полностью локализованные тексты.
- `src/data/content.js` — языки, маршруты и нормализация содержимого.
- `src/lib.js` — расчёт, валидация, отправка, UTM и события.
- `scripts/build.mjs` — SSG, SEO, hreflang, sitemap и robots.
- `wrangler.jsonc` — запуск в собственном аккаунте Cloudflare.

## Разработка и проверка

Node.js 22.12+ (рекомендуется актуальный LTS), npm.

```sh
npm ci
npm run dev
npm run build
npm run check
npm run dev:worker
npx wrangler deploy --dry-run
```

`npm run check` проверяет тарифы, номера, локализованные сообщения, успешный/неуспешный ответ формы с подменённым fetch, полноту переводов, все HTML-страницы, микроразметку, ссылки и файлы. Тесты **не отправляют реальные заявки**. Доставка в аккаунт владельца Formspree не проверялась: она зависит от активности формы и настроек получателя.

## Cloudflare Workers

`SITE_URL` задан в переменных сборки Cloudflare: `https://mazganim-clean-air.gerasim459.workers.dev`. От него зависят canonical, Open Graph и sitemap. Для локальной сборки используется тот же адрес из `company.siteUrl`; при необходимости переопределите его через `.env` или окружение. Пример — `.env.example`.

```sh
npx wrangler login
npm run deploy
```

Команда проверяет бизнес-данные, собирает сайт, запускает тесты и выполняет `wrangler deploy`. При необходимости смените имя Worker в `wrangler.jsonc`. После подключения собственного домена пересоберите с новым `SITE_URL`.

Автоматическая публикация настроена через Cloudflare Workers Builds:

| Настройка | Значение |
| --- | --- |
| Worker name | `mazganim-clean-air` — должно совпадать с `wrangler.jsonc` |
| GitHub repository | `stackofart/mazganim2` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run build:checked` |
| Deploy command | `npx wrangler deploy` |
| Build variable `SITE_URL` | `https://mazganim-clean-air.gerasim459.workers.dev` |
| Node.js | 22 — версия задана в `.nvmrc` |

Cloudflare устанавливает зависимости по `package-lock.json`, запускает сборку и тесты, затем публикует результат. Ошибка сборки или тестов останавливает публикацию. Без `SITE_URL` сборка в Workers Builds завершается ошибкой, чтобы не опубликовать SEO-ссылки на закрытый предпросмотр. В переменных **сборки**, а не runtime-настройках, задайте реальный адрес.

Каждый push в `main` обновляет сайт. Сохранение файла на компьютере само по себе публикацию не запускает: изменения нужно закоммитить и отправить в GitHub. Изменение файла через веб-интерфейс GitHub с коммитом в `main` тоже запускает публикацию. Автосборки других веток отключены. Для отката можно отменить проблемный коммит через `git revert` и отправить новый коммит.

Конфигурация `.openai/hosting.json` нужна только закрытому предпросмотру Sites и не требуется для вашего аккаунта Cloudflare. Cloudflare-токены, `.env` и `.dev.vars` не должны попадать в репозиторий. Публикацию выполняет сама платформа Cloudflare через существующее подключение GitHub; GitHub Actions и локальная авторизация Wrangler для обычных обновлений не нужны.

## Заявки и контакты

Кнопка отправки передаёт имя, израильский мобильный номер, город, тип, количество, комментарий, язык и UTM-метки в исходную форму Formspree. Есть локальная валидация, honeypot, блокировка повторного клика, таймаут 15 секунд и состояния ошибки/успеха. Успех показывается только после успешного HTTP-ответа. Обращение не объявляется подтверждённой записью. Серверная защита от спама и лимиты зависят от настроек Formspree.

Подготовка сообщения ничего не отправляет. Посетитель может скопировать текст или открыть его в WhatsApp. Выбор 1/2/3 блоков синхронизируется с формой. Сложные системы и 4+ блока не получают выдуманную цену. Форма не хранит персональные данные в localStorage/sessionStorage; поля заблокированы до загрузки JavaScript. Телефон, Telegram и языковые ссылки в футере доступны без JavaScript.

Если меняется получатель формы, обновите `company.formEndpoint` и CSP `connect-src` в `public/_headers`, а также описание обработки данных. Formspree — единственный внешний сервис для отправки заявок; собственных серверных секретов нет.

## SEO и продвижение

Каждый язык имеет отдельный HTML, canonical, reciprocal hreflang и x-default. Иврит и арабский используют `dir=rtl` и локальные Noto-шрифты. Микроразметка: WebSite, WebPage, FAQPage, HVACBusiness с прайсом и географией. Указаны title, description, Open Graph / X title и description, favicon, sitemap и robots. Индексация включена после переноса исходных бизнес-данных; закрытый предпросмотр Sites при этом остаётся закрытым. FAQ-разметка не гарантирует расширенные сниппеты Google.

Метки `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` хранятся на время вкладки и попадают в обращение. Кнопка «Поделиться» сохраняет текущий язык и добавляет `utm_source=referral&utm_medium=share`. Не размещайте персональные данные в UTM.

События в `window.dataLayer`: `lead_start`, `service_view`, `price_select`, `lead_prepared`, `lead_submitted`, `lead_whatsapp_click`, `telegram_click`, `lead_copy`, `phone_click`, `site_share`. Контактные данные в события не включены. **GA4, GTM, Meta Pixel не подключены**; это готовые точки подключения вашей аналитики. `lead_submitted` означает приём формы сервисом, а не подтверждённый выезд или продажу. При подключении аналитики обновите CSP, описание обработки данных и настройки согласия.

Шрифты и изображения размещены локально. CSS/JS с хешами кешируются год. Для соцсетей добавлена обложка `public/images/social-cover.jpg` (1200×630) и метатеги Open Graph / X. Непроверенные отзывы, рейтинги, проценты экономии и медицинские гарантии не добавлены.

## Ресурсы и дополнительная автоматизация

Первый экран — цельная иллюстрация квартиры с добрым, уставшим кондиционером и птицей. При приближении к WhatsApp или клавиатурном фокусе кондиционер открывает глаза; реплика меняется по состоянию. Возле формы показан тот же персонаж. Тексты всех пяти языков — `src/data/scene.js`; поведение — [docs/apartment-scene.md](docs/apartment-scene.md). Логотип с птицей и солнцем, иллюстрации и точные промпты описаны в [docs/character-assets.json](docs/character-assets.json).

Пейзаж `public/images/mountain-coast.webp` сохранён как прежний художественный материал. Обложка `public/images/social-cover.jpg` продолжает использоваться для ссылок. Они созданы встроенным ImageGen; промпты — `docs/assets.md`. Golos Text, Noto Sans Hebrew и Noto Sans Arabic размещены локально под SIL OFL; лицензии в `public/fonts/`.

Необязательный WebMCP `prepare_cleaning_request` заполняет видимую форму и готовит сообщение. Ничего не отправляет. Обычный сайт от него не зависит.

Архитектура соответствует [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) и рекомендациям Google об [отдельных адресах языковых версий](https://developers.google.com/search/docs/specialty/international/localized-versions).

## Дизайн и продвижение

За дренажом больше не закреплена отдельная услуга: вместо него добавлена заправка газом. В форме есть выбор услуги; заправка всегда рассчитывается отдельно и не использует тарифы чистки. Полезные блоки и FAQ доступны на всех пяти языках.

Готовые тексты постов, ссылки с UTM, сценарий видео и следующие шаги для SEO — [docs/promotion.md](docs/promotion.md).
