# Изображение и шрифты

Hero: `public/images/hero.jpg`. Создано встроенным ImageGen, 1536×1024, затем перекодировано в JPEG для сайта. Это декоративная иллюстрация интерьера, не реальный объект заказчика. При публикации не выдавать её за портфолио выполненных работ.

Фактический промпт:

> Use case: photorealistic-natural
> Asset type: landscape website hero image, 1536x1024 pixels if possible, exactly one image.
> Primary request: a bright modern Mediterranean apartment, presented as high-end interior architectural photography for an air-conditioner cleaning company.
> Scene/backdrop: an off-white plaster wall, a light oak cabinet partly visible along the lower left edge, a very subtle pale blue sofa partly visible at lower right, and a soft olive tree at the far right.
> Subject: an elegant white wall-mounted split air conditioner in the upper center-right, visually prominent, with realistic correct proportions, carefully modeled vents and clean white housing.
> Composition/framing: refined landscape architectural photograph with straight verticals, an airy uncluttered composition and clear wall space. The air conditioner is the visual focal point.
> Lighting/mood: natural sunlight from the left casts graceful leaf shadows on the wall; clean, fresh, calm and welcoming.
> Color palette: understated light neutral colors, off-white plaster, natural light oak, muted pale blue and soft olive green.
> Materials/textures: authentic subtle plaster texture, natural wood grain and realistic fabric; photorealistic surfaces and lighting.
> Constraints: decorative concept imagery, not documentation of a real customer installation. No people, no text, no labels, no logos, no watermark, no UI.

Golos Text: Google Fonts, latin and cyrillic variable WOFF2, SIL Open Font License. Fonts are served locally; the browser does not call Google Fonts.

Для иврита и арабского добавлены локальные Noto Sans Hebrew и Noto Sans Arabic из Google Fonts. Их лицензии: `public/fonts/OFL-noto-hebrew.txt` и `public/fonts/OFL-noto-arabic.txt`.

## Mountain print redesign — 2026-09-11

Пейзаж и его мобильная версия сохранены как прежний художественный материал, но на странице больше не загружаются. Обложка соцсетей остаётся используемым файлом. Текущий первый экран описан ниже.

Новые изображения созданы встроенным ImageGen. Это оригинальная художественная интерпретация средиземноморского пейзажа, а не фотография места, сотрудников или выполненных работ. Референс пользователя — японская горная гравюра; финальная композиция самостоятельная. Ивритная печать «אוויר טוב» добавлена живым текстом в интерфейс.

Файлы проекта:
- `public/images/mountain-coast.webp` — главный пейзаж, 1536×1024.
- `public/images/mountain-coast-768.webp` — мобильная версия, 768×512.
- `public/images/social-cover.jpg` — обложка ссылок, 1200×630.

WebP закодированы через cwebp, JPEG для Open Graph — через sips; иллюстрации создавал ImageGen. Старый `hero.jpg` больше не используется на странице.

### Финальный промпт пейзажа

```text
Use case: illustration-story. Create one original landscape artwork for the hero of an Israeli air-conditioner cleaning brand's website. Landscape 3:2 composition, high resolution. A striking modern Japanese woodblock-print inspired Mediterranean landscape: bold terracotta red mountain ridges rise above deep turquoise sea and rolling olive-green hills, warm ivory clouds curl in clean graphic shapes, a pale apricot sun floats in an ivory sky. Small white flat-roofed Mediterranean homes with a few discreet wall-mounted air conditioners nestle at the foot of the hills; an olive branch frames the lower left. Inspired by the user's reference of a vivid Japanese mountain nature print, but invent an original Israeli coastal landscape, not Mount Fuji and not a copy of an existing print. Rich flat ink layers, fine dark indigo engraved contour lines, subtle woodgrain and handmade paper grain, generous calm sky, elegant asymmetrical composition, sophisticated warm off-white/terracotta/deep teal palette. The mountain is the main hero, bold and graphic, houses are small secondary details. Editorial art print quality, no photorealism, no gradients or 3D, no lettering, no logos, no watermark, no border. This is a background illustration, not a webpage mockup.
```

### Финальный промпт обложки

Вход: созданный выше пейзаж, как художественный референс и исходный материал.

```text
Create a finished social sharing cover image for CoolClean, using the attached original woodblock landscape as the artwork. Intended Open Graph image, wide 1200 x 630 composition (approximately 1.91:1). Keep the same warm ivory handmade-paper texture, deep teal Mediterranean sea, terracotta mountains and tiny white Israeli homes. Design a sophisticated editorial poster: the left 42% is a clean warm ivory panel with large exceptionally crisp deep teal sans-serif text 'CoolClean.' on one line at top, followed by smaller uppercase text 'AIR CONDITIONER CARE' and 'IN ISRAEL' on separate lines. At bottom left write exactly '054-757-7371'. A small terracotta sun mark above the heading. Right 58% showcases the mountain/sea artwork, with a clean full-height edge between artwork and typography. High contrast text, generous margins, all letters fully inside the canvas. No other words, no Hebrew, no Cyrillic, no mockup device, no watermark. Final production-ready image, not a web page. Preserve the original artwork's beauty and detail.
```

## Квартирная иллюстрация и логотип с птицей

Текущий первый экран использует цельную иллюстрацию, созданную и отредактированную встроенным ImageGen. У кондиционера удалены все черты лица, анатомия птицы исправлена до двух лап. Комната, окно, израильская застройка и вечерний свет сохранены. Это иллюстрация, а не фотография выполненной работы.

- `public/images/quiet-apartment-natural.webp` — исправленная основная сцена, 1536×1024.
- `public/images/quiet-apartment-natural-768.webp` — её мобильная версия, 768×512.
- Прежние `quiet-apartment.webp`, `quiet-apartment-768.webp` и `quiet-apartment-awake.webp` — архивные варианты, больше не подключённые к странице.
- `public/images/bird-mark.webp` — знак для шапки и подвала, 256×256.
- `public/images/bird-mark-source.png` — большой исходник знака; верхняя птица с солнцем из пользовательского референса, очищенная от надписей и фона.
- `public/favicon.png` — версия знака для вкладки браузера, 64×64.

Точные финальные промпты и режим генерации: [character-assets.json](character-assets.json). Изображения конвертированы в WebP через cwebp. Персонаж и его реплики используются только на первом экране.
