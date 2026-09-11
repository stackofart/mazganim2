import { company } from "../src/data/company.js";
import { calculatePrice, normalizePhone, campaignKeys, systemTypes, leadLocales } from "../src/lead-fields.js";

const MAX_BODY_BYTES = 8192;
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  } });
}

function configuration(request, env) {
  const url = new URL(request.url);
  const loopback = hostname => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const local = loopback(url.hostname);
  let origin = local ? url.origin : new URL(env.SITE_URL || company.siteUrl).origin;
  // Also support Vite's local /api proxy, whose page uses a different loopback port.
  if (local && request.headers.has("origin")) {
    try {
      const page = new URL(request.headers.get("origin"));
      if (loopback(page.hostname) && ["http:", "https:"].includes(page.protocol)) origin = page.origin;
    } catch { /* An invalid Origin is rejected below. */ }
  }
  const siteKey = env.TURNSTILE_SITE_KEY;
  const testMode = local && siteKey === TEST_SITE_KEY && env.TURNSTILE_SECRET_KEY === TEST_SECRET_KEY;
  const ready = Boolean(
    env.LEAD_EMAIL?.send && env.LEAD_RATE_LIMITER?.limit &&
    emailPattern.test(env.LEAD_EMAIL_FROM || "") &&
    emailPattern.test(env.LEAD_EMAIL_TO || "") &&
    siteKey && env.TURNSTILE_SECRET_KEY &&
    (testMode || (siteKey.startsWith("0x") && env.TURNSTILE_SECRET_KEY.startsWith("0x")))
  );
  return { ready, siteKey, origin, testMode };
}

class InputError extends Error {
  constructor(status = 400, code = "invalid_request") { super(code); this.status = status; this.code = code; }
}

async function readBody(request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new InputError(413);
  if (!request.body) throw new InputError();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new InputError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new InputError(); }
}

function clean(value, max, required = false) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max) throw new InputError();
  const result = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (required && !result) throw new InputError();
  return result;
}

function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError();
  if (body.website) throw new InputError();
  const service = body.service === undefined ? "cleaning" : body.service;
  if (!["cleaning", "refrigerant"].includes(service)) throw new InputError();
  if (!systemTypes.includes(body.type) || !leadLocales.includes(body.locale) ||
    !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 10) throw new InputError();
  const phone = normalizePhone(clean(body.phone, 22, true));
  if (!phone) throw new InputError();
  const campaign = body.campaign ?? {};
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) throw new InputError();
  return {
    name: clean(body.name, 80), city: clean(body.city, 100, true), phone,
    service, note: clean(body.note, 300), type: body.type, quantity: body.quantity, locale: body.locale,
    turnstileToken: clean(body.turnstileToken, 2048, true),
    campaign: Object.fromEntries(campaignKeys.map(key => [key, clean(campaign[key], 120)])),
  };
}

function notification(lead, env, requestId) {
  const types = { wall: "Настенный", multi: "Мультисплит", vrf: "VRF", unknown: "Нужна консультация" };
  const price = calculatePrice(lead);
  const lines = [
    "Новая заявка на обслуживание кондиционеров", "",
    `Номер заявки: ${requestId}`, `Дата: ${new Date().toISOString()}`,
    `Имя: ${lead.name || "Не указано"}`, `Телефон: ${lead.phone}`, `Город: ${lead.city}`,
    `Услуга: ${lead.service === "refrigerant" ? "Заправка газом" : "Чистка и дезинфекция"}`,
    `Тип: ${types[lead.type]}`, `Количество: ${lead.quantity}`,
    `Ориентировочная стоимость: ${price === null ? "По согласованию" : `${price} ₪`}`,
    `Комментарий: ${lead.note || "Нет"}`, `Язык формы: ${lead.locale}`, "",
    ...Object.entries(lead.campaign).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`),
    "", "Время визита и окончательную стоимость нужно согласовать с клиентом.",
  ];
  // Addresses, headers and prices never come from the submitted JSON.
  return { from: env.LEAD_EMAIL_FROM, to: env.LEAD_EMAIL_TO,
    subject: `${company.name}: новая заявка ${requestId.slice(0, 8)}`, text: lines.join("\n") };
}

// fetcher is injected only by tests; production always calls Cloudflare Siteverify.
export async function handleRequest(request, env, fetcher = fetch) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!["/api/leads", "/api/lead-config"].includes(pathname)) return json({ error: "not_found" }, 404);
  const method = pathname === "/api/lead-config" ? "GET" : "POST";
  if (request.method !== method) return json({ error: "method_not_allowed" }, 405, { Allow: method });
  try {
    const config = configuration(request, env);
    if (!config.ready) return json({ error: "unavailable" }, 503);
    if (method === "GET") return json({ siteKey: config.siteKey });
    if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site")
      return json({ error: "forbidden" }, 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return json({ error: "unsupported_media_type" }, 415);
    // Anonymous form: a small per-IP burst limit complements Turnstile. Shared NATs share this limit.
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    if (!(await env.LEAD_RATE_LIMITER.limit({ key: `lead:${ip}` })).success)
      return json({ error: "rate_limited" }, 429, { "Retry-After": "60" });
    const lead = validate(await readBody(request));
    let verification;
    try {
      const result = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: lead.turnstileToken, remoteip: ip }),
        signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) return json({ error: "unavailable" }, 503);
      verification = await result.json();
    } catch { return json({ error: "unavailable" }, 503); }
    if (!verification?.success || (!config.testMode &&
      (verification.hostname !== new URL(config.origin).hostname || verification.action !== "lead")))
      return json({ error: "challenge_failed" }, 400);

    const requestId = crypto.randomUUID();
    try {
      // Await acceptance: no waitUntil, detached sends or automatic delivery retries.
      await env.LEAD_EMAIL.send(notification(lead, env, requestId));
    } catch {
      // Do not log the provider error: it may contain recipient addresses or submitted data.
      console.error(JSON.stringify({ event: "lead_email_failed", requestId }));
      return json({ error: "delivery_failed" }, 502);
    }
    return json({ status: "accepted", requestId }, 202);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.code }, error.status);
    return json({ error: "unavailable" }, 503);
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
