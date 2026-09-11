import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../worker/index.js";

const origin = "https://mazganim-clean-air.gerasim459.workers.dev";
const valid = { name: "Test", phone: "0541234567", city: "Тест / Test / בדיקה", type: "wall", quantity: 2, note: "Test only", locale: "he", turnstileToken: "token", campaign: { utm_source: "instagram" } };
function setup() {
  const sent = [], verified = [];
  const env = {
    SITE_URL: origin, LEAD_EMAIL_FROM: "requests@example.com", LEAD_EMAIL_TO: "owner@example.net",
    TURNSTILE_SITE_KEY: "0x-test-site", TURNSTILE_SECRET_KEY: "0x-test-secret",
    LEAD_EMAIL: { send: async message => { sent.push(message); return { messageId: "id" }; } },
    LEAD_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async () => new Response("asset") },
  };
  const fetcher = async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    verified.push(JSON.parse(options.body));
    return Response.json({ success: true, hostname: new URL(origin).hostname, action: "lead" });
  };
  const request = (body = valid, headers = {}) => new Request(`${origin}/api/leads`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { env, sent, verified, fetcher, request };
}

test("Worker awaits Cloudflare email acceptance and fixes recipient, headers and prices on the server", async () => {
  const s = setup(); let finish;
  s.env.LEAD_EMAIL.send = message => { s.sent.push(message); return new Promise(resolve => { finish = resolve; }); };
  const pending = handleRequest(s.request({ ...valid, to: "attacker@example.com", from: "spoof@example.com", subject: "Injected", price: 1, html: "<script>bad</script>" }), s.env, s.fetcher);
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, "owner@example.net");
  assert.equal(s.sent[0].from, "requests@example.com");
  assert.match(s.sent[0].subject, /^CoolClean: новая заявка /);
  assert.match(s.sent[0].text, /450 ₪/);
  assert.match(s.sent[0].text, /\+972541234567/);
  assert.match(s.sent[0].text, /instagram/);
  assert.equal(s.sent[0].html, undefined);
  finish({ messageId: "ok" });
  const result = await pending;
  assert.equal(result.status, 202);
  assert.equal((await result.json()).status, "accepted");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(s.verified[0], { secret: "0x-test-secret", response: "token", remoteip: "192.0.2.10" });
});

test("invalid, oversized or injected form fields never send email", async () => {
  const invalid = [null, [], "{", { ...valid, city: " " }, { ...valid, city: "x".repeat(101) },
    { ...valid, phone: "123" }, { ...valid, phone: ["0541234567"] }, { ...valid, name: {} },
    { ...valid, note: "x".repeat(301) }, { ...valid, quantity: "2" }, { ...valid, quantity: 0 },
    { ...valid, quantity: 11 }, { ...valid, quantity: 1.5 }, { ...valid, type: "other" },
    { ...valid, locale: "de" }, { ...valid, website: "bot" }, { ...valid, turnstileToken: "" },
    { ...valid, campaign: [] }, { ...valid, campaign: { utm_source: {} } },
    { ...valid, campaign: { utm_source: "x".repeat(121) } }, "x".repeat(8193)];
  for (const input of invalid) {
    const s = setup(), result = await handleRequest(s.request(input), s.env, s.fetcher);
    assert.ok([400, 413].includes(result.status), JSON.stringify(input));
    assert.equal(s.sent.length, 0); assert.equal(s.verified.length, 0);
  }
});

test("body limit applies to streamed bodies without Content-Length", async () => {
  const s = setup();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4000)); controller.enqueue(new Uint8Array(5000)); controller.close(); } });
  const request = new Request(`${origin}/api/leads`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body, duplex: "half" });
  assert.equal((await handleRequest(request, s.env, s.fetcher)).status, 413);
  assert.equal(s.sent.length, 0);
});

test("foreign origins, form posts, wrong methods and unknown API paths are refused", async () => {
  const s = setup();
  for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }])
    assert.equal((await handleRequest(s.request(valid, headers), s.env, s.fetcher)).status, 403);
  assert.equal((await handleRequest(s.request(valid, { "Content-Type": "text/plain" }), s.env, s.fetcher)).status, 415);
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT"])
    assert.equal((await handleRequest(new Request(`${origin}/api/leads`, { method }), s.env, s.fetcher)).status, 405);
  assert.equal((await handleRequest(new Request(`${origin}/api/unknown`), s.env, s.fetcher)).status, 404);
  assert.equal(s.sent.length, 0);
  assert.equal(await (await handleRequest(new Request(`${origin}/he/`), s.env)).text(), "asset");
});

test("challenge failures, wrong hostname/action and verifier outages fail closed", async () => {
  for (const response of [{ success: false }, { success: true, hostname: "evil.example", action: "lead" }, { success: true, hostname: new URL(origin).hostname, action: "login" }]) {
    const s = setup();
    assert.equal((await handleRequest(s.request(), s.env, async () => Response.json(response))).status, 400);
    assert.equal(s.sent.length, 0);
  }
  for (const fetcher of [async () => { throw new Error("Offline"); }, async () => new Response("down", { status: 500 }), async () => new Response("invalid json")]) {
    const s = setup(); assert.equal((await handleRequest(s.request(), s.env, fetcher)).status, 503); assert.equal(s.sent.length, 0);
  }
});

test("a consumed Turnstile token cannot send a second email", async () => {
  const s = setup(); let used = false;
  const fetcher = async (...args) => { if (used) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }); used = true; return s.fetcher(...args); };
  assert.equal((await handleRequest(s.request(), s.env, fetcher)).status, 202);
  assert.equal((await handleRequest(s.request(), s.env, fetcher)).status, 400);
  assert.equal(s.sent.length, 1);
});

test("rate limit returns retry time without invoking Turnstile or email", async () => {
  const s = setup(); s.env.LEAD_RATE_LIMITER.limit = async ({ key }) => { assert.equal(key, "lead:192.0.2.10"); return { success: false }; };
  const result = await handleRequest(s.request(), s.env, s.fetcher);
  assert.equal(result.status, 429); assert.equal(result.headers.get("retry-after"), "60");
  assert.equal(s.sent.length, 0); assert.equal(s.verified.length, 0);
});

test("delivery errors do not report success or expose contact data", async (t) => {
  const s = setup(); const logged = [];
  t.mock.method(console, "error", message => logged.push(message));
  s.env.LEAD_EMAIL.send = async () => { throw new Error("Private data: owner@example.net"); };
  const result = await handleRequest(s.request(), s.env, s.fetcher);
  assert.equal(result.status, 502); assert.deepEqual(await result.json(), { error: "delivery_failed" });
  assert.equal(logged.length, 1); assert.doesNotMatch(logged[0], /owner|Test|054/);
});

test("missing config and public Turnstile test keys fail closed on production; config never leaks secrets", async () => {
  for (const key of ["LEAD_EMAIL_TO", "LEAD_EMAIL_FROM", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "LEAD_EMAIL", "LEAD_RATE_LIMITER"]) {
    const s = setup(); delete s.env[key];
    assert.equal((await handleRequest(s.request(), s.env, s.fetcher)).status, 503);
    assert.equal((await handleRequest(new Request(`${origin}/api/lead-config`), s.env)).status, 503);
  }
  const s = setup();
  const config = await handleRequest(new Request(`${origin}/api/lead-config`), s.env);
  assert.deepEqual(await config.json(), { siteKey: "0x-test-site" });
  s.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  s.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  assert.equal((await handleRequest(s.request(), s.env, s.fetcher)).status, 503);
  assert.equal((await handleRequest(new Request("http://localhost:8787/api/lead-config"), s.env)).status, 200);
  const localRequest = new Request("http://127.0.0.1:8787/api/leads", {
    method: "POST", headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" }, body: JSON.stringify(valid),
  });
  assert.equal((await handleRequest(localRequest, s.env, s.fetcher)).status, 202);
});

test("quote-only systems never acquire a fixed price and text cannot inject mail headers", async () => {
  const s = setup();
  const result = await handleRequest(s.request({ ...valid, type: "vrf", name: "Test\r\nBcc: attacker@example.com", note: "<b>plain text</b>" }), s.env, s.fetcher);
  assert.equal(result.status, 202); assert.match(s.sent[0].text, /По согласованию/);
  assert.doesNotMatch(s.sent[0].text, /\nBcc:/); assert.equal(s.sent[0].bcc, undefined);
});
