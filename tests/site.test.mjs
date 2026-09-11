import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { makeRequest, whatsappUrl } from "../src/lib.js";
import { company } from "../src/data/company.js";

test("request validates type, bounded quantity and city", () => {
  assert.throws(() => makeRequest({ type: "wall", quantity: 0, city: "City" }));
  assert.throws(() =>
    makeRequest({ type: "wall", quantity: 11, city: "City" }),
  );
  assert.throws(() =>
    makeRequest({ type: "wall", quantity: 1.5, city: "City" }),
  );
  assert.throws(() =>
    makeRequest({ type: "unknown-value", quantity: 1, city: "City" }),
  );
  assert.throws(() => makeRequest({ type: "wall", quantity: 1, city: "  " }));
  const text = makeRequest(
    {
      type: "wall",
      quantity: 2,
      city: "Тестовый город",
      name: "Тест",
      note: "Нужна чистка",
    },
    { utm_source: "instagram", utm_campaign: "summer" },
  );
  assert.match(text, /Количество: 2/);
  assert.match(text, /Источник: instagram \/ summer/);
});
test("unconfigured destination never directs leads to a made-up number", () => {
  if (!company.whatsapp) assert.equal(whatsappUrl("test"), "");
  else {
    const url = new URL(whatsappUrl("Привет & + ?"));
    assert.equal(url.host, "wa.me");
    assert.equal(url.searchParams.get("text"), "Привет & + ?");
  }
});
test("SSG delivers content, metadata, valid JSON-LD and only real local anchors", async () => {
  const html = await readFile("dist/index.html", "utf8");
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  for (const id of ["services", "process", "prices", "faq", "contact"])
    assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes("Глубокая чистка"));
  assert.match(html, /<fieldset[^>]*disabled/);
  assert.match(html, /<meta name="description" content="Чистка кондиционеров/);
  assert.ok(html.includes("Запрос на чистку"));
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )[1];
  const data = JSON.parse(json);
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(
    data["@graph"].find((n) => n["@type"] === "FAQPage").mainEntity.length,
    6,
  );
  assert.match(html, /<link rel="canonical" href="https:\/\/[^\"]+\/"/);
  for (const match of html.matchAll(/href="#([^\"]+)"/g))
    assert.ok(html.includes(`id="${match[1]}"`), `Missing ${match[1]} target`);
  if (!company.verified) {
    assert.match(html, /noindex, nofollow/);
    assert.ok(!data["@graph"].some((n) => n["@type"] === "HVACBusiness"));
  }
  for (const match of html.matchAll(
    /(?:src|href)="(\/(?:assets|fonts|images)\/[^\"?#]+)"/g,
  ))
    await access(`dist${match[1]}`);
});
test("robots and sitemap reflect the same configured origin", async () => {
  const robots = await readFile("dist/robots.txt", "utf8"),
    sitemap = await readFile("dist/sitemap.xml", "utf8");
  const root = robots.match(/Sitemap: (https:\/\/[^\s]+)\/sitemap.xml/)[1];
  assert.ok(sitemap.includes(`<loc>${root}/</loc>`));
  if (!company.verified) assert.match(robots, /Disallow: \//);
});
