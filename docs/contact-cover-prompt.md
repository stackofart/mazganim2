# Обложка с обновлёнными контактами

Создана 13 сентября 2026 встроенным `image_gen.imagegen`. Исходник для правки: `public/images/social-cover.jpg`. Итог: `public/images/social-cover-contacts.jpg`, JPEG 1200×630; уменьшение и конвертация через Pillow. Старый файл оставлен как архив, новый URL используется в метаданных всех языков.

## Финальный промпт

```text
Use case: text-localization.
Asset type: existing website social-sharing cover, keep its 1200×630 landscape composition.
Input image: edit target.
Update only the outdated branding and contact text on the LEFT ivory panel. Replace 'CoolClean.' with the site's current brand 'זיז' (Hebrew letters, right-to-left, exact letters zayin-yod-zayin), using strong clean deep-teal typography. Keep the small existing terracotta sun above it and the existing English descriptor 'AIR CONDITIONER CARE' / 'IN ISRAEL'. Replace the old phone line '054-757-7371' with exactly TWO equally readable separate lines: '052-446-4677' then '055-770-7506'. Both must sit fully inside the ivory panel near the bottom, with comfortable margins and no clipping. All digit strings are left-to-right; use plain hyphens as shown. These are the only phone numbers anywhere in the output.
Preserve the original right-hand coastline, mountain, sea, houses, olive leaves, Japanese woodblock illustration style, paper texture, cream/terracotta/deep-teal palette, panel boundary and overall layout. Make no other scene edits, no new icons, QR codes, words, objects or watermarks. Final crisp production-ready image.
```
