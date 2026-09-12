import { build, loadEnv } from "vite";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { company } from "../src/data/company.js";
import { contentFor, languages, localePath } from "../src/data/content.js";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
if (env.WORKERS_CI === "1" && !env.SITE_URL) {
  throw new Error("Set SITE_URL in Cloudflare build variables before deploying.");
}
const origin = new URL(env.SITE_URL || company.siteUrl).origin;
if (!origin.startsWith("https://")) throw new Error("SITE_URL must use HTTPS.");
const isPublic =
  company.verified &&
  /^\+9725\d{8}$/.test(company.phone) &&
  company.serviceArea.length > 0;
await build({ build: { outDir: "dist" } });
await build({
  build: { ssr: "src/entry-server.js", outDir: ".ssg", emptyOutDir: true },
});
const { render } = await import(resolve(".ssg/entry-server.js"));
const template = await readFile("dist/index.html", "utf8");
const escapeAttr = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
for (const lang of languages) {
  const t = contentFor(lang.code),
    url = `${origin}${localePath(lang.code)}`,
    title = `${t.pageTitle} | ${company.name}`;
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: `${origin}/`,
      name: company.name,
      image: `${origin}/images/social-cover.jpg`,
      inLanguage: languages.map((l) => l.code),
    },
    {
      "@type": "WebPage",
      "@id": `${url}#page`,
      url,
      name: title,
      description: t.description,
      inLanguage: lang.code,
      isPartOf: { "@id": `${origin}/#website` },
    },
    {
      "@type": "FAQPage",
      inLanguage: lang.code,
      mainEntity: t.faqs.map((faq) => ({
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
      image: `${origin}/images/social-cover.jpg`,
      sameAs: [company.telegram],
      areaServed: company.serviceArea.map((name) => ({
        "@type": "City",
        name,
      })),
      contactPoint: {
        "@type": "ContactPoint",
        telephone: company.phone,
        contactType: "customer service",
        availableLanguage: languages.map((l) => l.label),
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: t.serviceOptions[0],
        itemListElement: [1, 2, 3].map((quantity) => ({
          "@type": "Offer",
          name: t.priceLabels[quantity - 1],
          price: company.prices[quantity],
          priceCurrency: company.currency,
          url: `${url}#prices`,
          itemOffered: {
            "@type": "Service",
            name: t.serviceOptions[0],
            provider: { "@id": `${origin}/#business` },
          },
        })),
      },
    });
  if (isPublic) graph.push(...t.services.map(service => ({
    "@type": "Service",
    "@id": `${url}#service-${service.id}`,
    name: service.name,
    description: service.text,
    serviceType: service.name,
    url: `${url}#${service.id}`,
    provider: { "@id": `${origin}/#business` },
    areaServed: company.serviceArea.map(name => ({ "@type": "City", name })),
  })));
  const meta = `
<link rel="canonical" href="${escapeAttr(url)}" />
${languages.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${escapeAttr(origin + localePath(l.code))}" />`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${escapeAttr(origin)}/" />
<meta name="robots" content="${isPublic ? "index, follow, max-image-preview:large" : "noindex, nofollow"}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="${{ ru: "ru_RU", he: "he_IL", ar: "ar_IL", fr: "fr_FR", en: "en_US" }[lang.code]}" />
<meta property="og:site_name" content="${escapeAttr(company.name)}" />
<meta property="og:title" content="${escapeAttr(title)}" />
<meta property="og:description" content="${escapeAttr(t.description)}" />
<meta property="og:url" content="${escapeAttr(url)}" />
<meta property="og:image" content="${origin}/images/social-cover.jpg" />
<meta property="og:image:secure_url" content="${origin}/images/social-cover.jpg" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeAttr(company.name + ' — ' + t.pageTitle)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${origin}/images/social-cover.jpg" />
<meta name="twitter:image:alt" content="${escapeAttr(company.name + ' — ' + t.pageTitle)}" />
<meta name="twitter:title" content="${escapeAttr(title)}" />
<meta name="twitter:description" content="${escapeAttr(t.description)}" />
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c")}</script>`;
  const font = {
    ru: "golos-cyrillic",
    en: "golos-latin",
    fr: "golos-latin",
    he: "noto-hebrew",
    ar: "noto-arabic",
  }[lang.code];
  const html = template
    .replace("/fonts/golos-cyrillic.woff2", `/fonts/${font}.woff2`)
    .replace(/<html[^>]*>/, `<html lang="${lang.code}" dir="${lang.dir}">`)
    .replace(
      '<div id="app"></div>',
      `<div id="app">${await render(lang.code)}</div>`,
    )
    .replace(/<title>.*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escapeAttr(t.description)}" />`,
    )
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript><p>${escapeAttr(t.noJs)}</p></noscript>`,
    )
    .replace("</head>", `${meta}</head>`);
  const folder = resolve("dist", lang.code === "ru" ? "" : lang.code);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, "index.html"), html);
}
await writeFile(
  "dist/robots.txt",
  `User-agent: *\n${isPublic ? "Allow: /" : "Disallow: /"}\n\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${languages.map((l) => `<url><loc>${origin}${localePath(l.code)}</loc>${languages.map((a) => `<xhtml:link rel="alternate" hreflang="${a.code}" href="${origin}${localePath(a.code)}"/>`).join("")}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/"/></url>`).join("")}</urlset>\n`,
);
await writeFile(
  "dist/404.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 — ${company.name}</title><style>body{font:18px/1.7 system-ui;color:#203d38;background:#f6f1e6;margin:12vh auto;padding:24px;max-width:640px}a{color:#b84b31;margin:12px;display:inline-block}</style><h1>404 — ${company.name}</h1><p>Page not found. Choose your language:</p>${languages.map((l) => `<a href="${localePath(l.code)}" lang="${l.code}">${l.label}</a>`).join("")}</html>`,
);
await rm(".ssg", { recursive: true, force: true });
console.log(
  `Prerendered ${languages.length} languages. Origin: ${origin}. Indexing: ${isPublic ? "enabled" : "disabled"}.`,
);
