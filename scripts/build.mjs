import { build, loadEnv } from "vite";
import { readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { company } from "../src/data/company.js";
import { faqs, services } from "../src/data/content.js";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const origin = new URL(env.SITE_URL || company.siteUrl).origin;
const isPublic =
  company.verified &&
  !!company.phone &&
  !!company.whatsapp &&
  company.serviceArea.length > 0;
await build({ build: { outDir: "dist" } });
await build({
  build: { ssr: "src/entry-server.js", outDir: ".ssg", emptyOutDir: true },
});
const { render } = await import(resolve(".ssg/entry-server.js"));
let template = await readFile("dist/index.html", "utf8");
const escapeAttr = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const title = `${company.name} — профессиональная чистка кондиционеров`;
const description = `Чистка кондиционеров ${company.name}${company.serviceArea.length ? " в " + company.serviceArea.join(", ") : ""}. Очистка внутреннего блока, фильтров и дренажа. Узнайте стоимость и запишитесь в WhatsApp.`;
const graph = [
  {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: company.name,
    inLanguage: "ru",
  },
  {
    "@type": "WebPage",
    "@id": `${origin}/#page`,
    url: `${origin}/`,
    name: title,
    description,
    inLanguage: "ru",
    isPartOf: { "@id": `${origin}/#website` },
  },
  {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  },
];
if (isPublic)
  graph.push({
    "@type": "HVACBusiness",
    "@id": `${origin}/#business`,
    name: company.name,
    url: `${origin}/`,
    telephone: company.phone,
    areaServed: company.serviceArea.map((name) => ({ "@type": "City", name })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Чистка кондиционеров",
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          description: service.text,
        },
      })),
    },
  });
const meta = `
    <link rel="canonical" href="${escapeAttr(origin)}/" />
    <meta name="robots" content="${isPublic ? "index, follow, max-image-preview:large" : "noindex, nofollow"}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:site_name" content="${escapeAttr(company.name)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(origin)}/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c")}</script>
`;
template = template
  .replace('<div id="app"></div>', `<div id="app">${await render()}</div>`)
  .replace(/<title>.*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
  .replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  )
  .replace("</head>", `${meta}</head>`);
await writeFile("dist/index.html", template);
await writeFile(
  "dist/robots.txt",
  `User-agent: *\n${isPublic ? "Allow: /" : "Disallow: /"}\n\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`,
);
await writeFile(
  "dist/404.html",
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Страница не найдена — ${escapeAttr(company.name)}</title><style>body{font:18px/1.7 system-ui;color:#17272e;margin:12vh auto;padding:24px;max-width:640px}a{color:#1875df}</style><h1>Здесь пока ничего нет.</h1><p>Возможно, ссылка изменилась. Все услуги и запись доступны на главной странице.</p><a href="/">На главную →</a></html>`,
);
await rm(".ssg", { recursive: true, force: true });
console.log(
  `Prerendered complete HTML. Origin: ${origin}. Indexing: ${isPublic ? "enabled" : "disabled (business information awaiting verification)"}.`,
);
