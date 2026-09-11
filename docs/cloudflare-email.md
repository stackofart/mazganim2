# Почта Cloudflare для заявок

## Что нужно до переключения сайта

1. **Домен отправителя.** Собственный домен должен быть подключён к Cloudflare Email Routing. `workers.dev` для почты не подходит. Сам сайт может остаться на `workers.dev`; переезд сайта на новый домен не обязателен.
2. **Подтверждённый получатель.** В Email Service → Email Routing добавьте Destination address и подтвердите адрес по ссылке из письма Cloudflare. Получатель может быть обычным Gmail. Подтверждение входа в аккаунт Cloudflare не заменяет подтверждение адреса Email Routing.
3. **DNS Email Routing.** Включите Routing для домена и проверьте статус DNS. Если у домена уже есть почта, сначала согласуйте MX/SPF, чтобы не нарушить её работу; можно использовать отдельный поддомен с Email Routing. Платный режим отправки произвольным получателям не нужен.
4. **Turnstile.** Создайте Managed-виджет для `mazganim-clean-air.gerasim459.workers.dev`, без pre-clearance. При переносе сайта добавьте новый hostname. Получите site key и secret key.
5. **Настройки Worker.** В Workers & Pages → `mazganim-clean-air` → Settings → Variables and Secrets добавьте четыре значения ниже как **Secret**. Это настройки выполнения Worker, не переменные сборки Workers Builds. Публичный site key тоже хранится здесь, чтобы Wrangler не удалял его при последующих публикациях; API выдаёт только его. Сохранённые секреты переживают `wrangler deploy`.

| Имя | Значение |
| --- | --- |
| `LEAD_EMAIL_FROM` | Например `requests@ваш-домен` — адрес на домене с активным Email Routing |
| `LEAD_EMAIL_TO` | Единственный подтверждённый email для заявок |
| `TURNSTILE_SITE_KEY` | Публичный ключ вашего виджета |
| `TURNSTILE_SECRET_KEY` | Секретный ключ этого же виджета |

В `wrangler.jsonc` уже настроены `LEAD_EMAIL`, `LEAD_RATE_LIMITER` и `ASSETS`. Email binding без списка адресов по умолчанию позволяет отправлять только на подтверждённые адреса аккаунта. Код дополнительно фиксирует получателя из `LEAD_EMAIL_TO` и не принимает `to`, `from`, заголовки или цену из формы. Почтового API-ключа в браузере нет; отдельный токен почтового сервиса не нужен.

`SITE_URL` в `wrangler.jsonc` задаёт допустимый Origin формы. Он должен совпадать с адресом сайта и переменной **сборки** `SITE_URL`, используемой для SEO. При смене домена измените оба значения.

После настройки почты и Turnstile слейте `cloudflare-email` в `main`: существующий Cloudflare Workers Builds сам выполнит сборку, тесты и публикацию. Проверьте `/api/lead-config`: должен быть HTTP 200 и только `siteKey`. Затем отправьте одну согласованную тестовую заявку и проверьте почтовый ящик, включая спам. Наличие настроек само по себе не доказывает доставку.

## Смена основных данных

- Получатель: подтвердите новый адрес в Email Routing и измените `LEAD_EMAIL_TO`. Пересборка не нужна.
- Отправитель: измените `LEAD_EMAIL_FROM` на адрес другого активного routing-домена.
- Телефон, Telegram, WhatsApp, тарифы: `src/data/company.js`, затем commit/push. Worker и клиент используют один источник цен.
- Тексты и уведомление об обработке данных: `src/data/locales/*.json`.

## Разработка без реальных писем

```sh
npm ci
npm run build:checked
npx wrangler deploy --dry-run
```

`npm run check` не отправляет письма и не вызывает внешние сервисы: в тестах используются подменённые bindings и Siteverify.

Для локальной проверки интерфейса и Worker используйте официальные тестовые ключи Turnstile:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 8787 \
  --var LEAD_EMAIL_FROM:requests@example.com \
  --var LEAD_EMAIL_TO:owner@example.net \
  --var TURNSTILE_SITE_KEY:1x00000000000000000000AA \
  --var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA
```

Откройте `http://127.0.0.1:8787`. Тестовые ключи разрешены кодом только для localhost/127.0.0.1; в production они блокируют API. Siteverify всё равно вызывается. Письма в `wrangler dev --local` имитируются и сохраняются локально самим Wrangler; **не включайте `remote: true` для email binding**. Для разработки Vue с HMR дополнительно запустите `npm run dev`: `/api` проксируется на порт 8787.

Другой вариант локальных настроек — скопировать `.dev.vars.example` в `.dev.vars`. Файл `.dev.vars` исключён из Git. В локальной имитации используйте только вымышленные контактные данные: Wrangler может записывать тело тестового письма в свои файлы и консоль.

## Поведение и ограничения

- `POST /api/leads`: только JSON до 8 КБ, проверенный Origin, валидные поля, honeypot и Turnstile. Токен должен соответствовать hostname сайта и action `lead`; Cloudflare проверяет срок действия и однократность использования.
- Rate Limiting: 5 попыток в 60 секунд на IP в одном центре Cloudflare. Лимит приблизительный, общий IP разделяется посетителями; это дополнительная защита, не строгий глобальный счётчик.
- `202 accepted` означает, что Cloudflare принял письмо. Это не подтверждение попадания во входящие или бронирования выезда.
- `400` — неверные поля/токен; `403` — другой Origin; `413` — большой запрос; `415` — другой формат; `429` — лимит; `502` — отказ отправки; `503` — нет настроек/недоступна проверка.
- При ошибках нет ложного успеха, скрытой очереди или автоматической повторной отправки. Поля остаются на экране. Если письмо было принято, но ответ потерялся, повторная отправка пользователем может создать дубликат.
- Персональные данные не пишутся кодом Worker в логи и не сохраняются в базе. Письма хранятся в почтовом ящике компании; Cloudflare обрабатывает их и технические данные защиты. Клиентский таймаут не отзывает уже принятое письмо.
- По текущим условиям Cloudflare отправка на подтверждённые адреса бесплатна и не расходует квоту платной отправки произвольным получателям. Регистрация/продление домена оплачивается отдельно; обычные лимиты Workers продолжают действовать.

Официальная документация: [тарифы](https://developers.cloudflare.com/email-service/platform/pricing/), [ограничения](https://developers.cloudflare.com/email-service/platform/limits/), [email binding](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
