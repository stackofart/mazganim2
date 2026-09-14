import { company } from '../src/data/company.js';

const OWNER = 'gerasim459@gmail.com';
const SENDER = 'requests@zeez.co.il';
const HOSTS = new Set(['zeez.co.il', 'www.zeez.co.il', 'mazganim-clean-air.gerasim459.workers.dev']);
const LOCALES = new Set(['ru', 'he', 'en', 'ar', 'fr']);
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_LIMIT = 8192;
const DAY = 86400000;
const response = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", ...headers },
});
class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const reject = (status, code) => { throw new HttpError(status, code); };
const log = (event, fields = {}) => console.log(JSON.stringify({ event, ...fields }));
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
function configured(env) {
  return env.LEADS_DB && env.EMAIL && env.LEAD_RATE_LIMITER && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY;
}
function allowedRequest(request, env) {
  const url = new URL(request.url);
  const local = env.LOCAL_DEVELOPMENT === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!local && (url.protocol !== 'https:' || !HOSTS.has(url.hostname))) reject(403, 'origin');
  if (request.headers.get('Origin') !== url.origin ||
      (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) reject(403, 'origin');
  return { url, local };
}
async function readJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') reject(415, 'content_type');
  if (request.headers.has('Content-Encoding')) reject(415, 'encoding');
  if (Number(request.headers.get('Content-Length')) > BODY_LIMIT) reject(413, 'body_size');
  if (!request.body) reject(400, 'body');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); reject(413, 'body_size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { reject(400, 'json'); }
}
export function validatePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject(400, 'fields');
  const keys = ['id', 'name', 'phone', 'note', 'locale', 'campaign', 'website', 'turnstileToken'];
  if (Object.keys(input).some(key => !keys.includes(key))) reject(400, 'fields');
  if (typeof input.id !== 'string' || !UUID.test(input.id)) reject(400, 'id');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || /[\x00-\x1f\x7f]/.test(input.name)) reject(400, 'name');
  if (typeof input.phone !== 'string' || input.phone.length > 22) reject(400, 'phone');
  let phone = input.phone.replace(/[\s()-]/g, '');
  if (/^05\d{8}$/.test(phone)) phone = '+972' + phone.slice(1);
  if (!/^\+9725\d{8}$/.test(phone)) reject(400, 'phone');
  if (typeof input.note !== 'string' || input.note.length > 300 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.note)) reject(400, 'note');
  if (!LOCALES.has(input.locale) || input.website !== '') reject(400, 'fields');
  if (typeof input.turnstileToken !== 'string' || !input.turnstileToken || input.turnstileToken.length > 2048) reject(400, 'challenge');
  const campaign = input.campaign;
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign) || Object.keys(campaign).some(k => !CAMPAIGN_KEYS.includes(k))) reject(400, 'campaign');
  const cleanCampaign = {};
  for (const key of CAMPAIGN_KEYS) if (key in campaign) {
    if (typeof campaign[key] !== 'string' || campaign[key].length > 120 || /[\x00-\x1f\x7f]/.test(campaign[key])) reject(400, 'campaign');
    cleanCampaign[key] = campaign[key];
  }
  return { id: input.id.toLowerCase(), name: input.name.trim(), phone, note: input.note.trim(), locale: input.locale, campaign: JSON.stringify(cleanCampaign) };
}
async function verifyChallenge(input, request, env, local) {
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: input.turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') || undefined, idempotency_key: crypto.randomUUID() }),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) reject(503, 'challenge_unavailable');
  const verification = await result.json();
  if (!verification.success || (!local && (verification.hostname !== new URL(request.url).hostname || verification.action !== 'booking'))) reject(400, 'challenge');
}
async function submit(request, env, ctx) {
  const { local } = allowedRequest(request, env);
  if (!configured(env)) reject(503, 'unavailable');
  // IP is only a coarse, generous abuse limit; mobile networks share addresses.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip && !local) reject(403, 'origin');
  if (!(await env.LEAD_RATE_LIMITER.limit({ key: ip || 'local' })).success) reject(429, 'rate_limit');
  const input = await readJson(request);
  const lead = validatePayload(input);
  const payloadHash = await hash(JSON.stringify(lead));
  const existing = await env.LEADS_DB.prepare('SELECT payload_hash FROM leads WHERE id = ?').bind(lead.id).first();
  if (existing) {
    if (existing.payload_hash !== payloadHash) reject(409, 'id_conflict');
    return response(202, { status: 'accepted', id: lead.id });
  }
  await verifyChallenge(input, request, env, local);
  const now = Date.now();
  try {
    await env.LEADS_DB.prepare(`INSERT INTO leads (id, payload_hash, name, phone, note, locale, campaign, created_at, next_attempt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .bind(lead.id, payloadHash, lead.name, lead.phone, lead.note, lead.locale, lead.campaign, now, now).run();
  } catch (error) {
    if (String(error.message).includes('LEAD_PHONE_LIMIT')) reject(429, 'phone_limit');
    if (String(error.message).includes('LEAD_CAPACITY')) { log('lead_capacity'); reject(503, 'capacity'); }
    throw error;
  }
  // Also handles an INSERT race with a different payload using the same ID.
  const saved = await env.LEADS_DB.prepare('SELECT payload_hash FROM leads WHERE id = ?').bind(lead.id).first();
  if (!saved) reject(503, 'unavailable');
  if (saved.payload_hash !== payloadHash) reject(409, 'id_conflict');
  log('lead_saved', { id: lead.id });
  ctx.waitUntil(deliverOne(env, lead.id).catch(() => log('outbox_error', { id: lead.id })));
  return response(202, { status: 'accepted', id: lead.id });
}
export async function deliverOne(env, id, now = Date.now()) {
  const lease = crypto.randomUUID();
  const lead = await env.LEADS_DB.prepare(`UPDATE leads SET status = 'sending', lease_id = ?, lease_until = ?, attempts = attempts + 1
    WHERE id = ? AND next_attempt <= ? AND (status = 'pending' OR (status = 'sending' AND lease_until <= ?)) RETURNING *`)
    .bind(lease, now + 120000, id, now, now).first();
  if (!lead) return;
  let sent;
  try {
    sent = await env.EMAIL.send({ from: { email: SENDER, name: 'Zeez — заявки сайта' }, to: OWNER,
      subject: `Новая заявка Zeez · ${lead.id.slice(0, 8)}`,
      text: [`Новая заявка с сайта Zeez`, `Номер заявки: ${lead.id}`, `Получена: ${new Date(lead.created_at).toISOString()}`,
        '', `Имя: ${lead.name}`, `Телефон: ${lead.phone}`, `Комментарий: ${lead.note || '—'}`, `Язык сайта: ${lead.locale}`,
        '', ...Object.entries(JSON.parse(lead.campaign)).map(([k, v]) => `${k}: ${v}`), '',
        'Если пришло повторное письмо с тем же номером заявки, это повтор доставки, а не новая заявка.'].join('\n') });
  } catch (error) {
    const code = typeof error.code === 'string' && /^E_[A-Z_]{1,60}$/.test(error.code) ? error.code : 'EMAIL_UNAVAILABLE';
    const delay = Math.min(6 * 3600000, 60000 * 2 ** Math.min(lead.attempts - 1, 9));
    await env.LEADS_DB.prepare(`UPDATE leads SET status = 'pending', lease_id = NULL, lease_until = NULL, last_error = ?, next_attempt = ?
      WHERE id = ? AND lease_id = ?`).bind(code, now + delay, id, lease).run();
    log('mail_retry', { id, attempt: lead.attempts, code });
    return;
  }
  // Provider acceptance is not proof of inbox delivery. Keep the durable copy.
  await env.LEADS_DB.prepare(`UPDATE leads SET status = 'mail_accepted', mail_id = ?, mail_accepted_at = ?,
    lease_id = NULL, lease_until = NULL, last_error = NULL WHERE id = ? AND lease_id = ?`)
    .bind(sent?.messageId || null, now, id, lease).run();
  log('mail_accepted', { id });
}
export async function drainOutbox(env, now = Date.now()) {
  const due = await env.LEADS_DB.prepare(`SELECT id FROM leads WHERE next_attempt <= ?
    AND (status = 'pending' OR (status = 'sending' AND lease_until <= ?)) ORDER BY next_attempt LIMIT 10`).bind(now, now).all();
  await Promise.all(due.results.map(({ id }) => deliverOne(env, id, now).catch(() => log('outbox_error', { id }))));
  const pending = await env.LEADS_DB.prepare(`SELECT count(*) AS count, min(created_at) AS oldest FROM leads WHERE status != 'mail_accepted'`).first();
  if (pending.count && pending.oldest < now - 15 * 60000) console.error(JSON.stringify({ event: 'outbox_stalled', count: pending.count, age_minutes: Math.floor((now - pending.oldest) / 60000) }));
  await env.LEADS_DB.prepare(`DELETE FROM leads WHERE status = 'mail_accepted' AND mail_accepted_at < ?`).bind(now - 30 * DAY).run();
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Only page navigations redirect. Existing tabs can still POST their forms
    // to the original same-origin API; never redirect a submitted lead body.
    if (!url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(request.method) &&
        HOSTS.has(url.hostname) && url.origin !== company.siteUrl) {
      const destination = new URL(company.siteUrl);
      destination.pathname = url.pathname;
      destination.search = url.search;
      if (/^\/ru\/?$/.test(destination.pathname)) destination.pathname = '/';
      else if (/^\/(he|en|ar|fr)$/.test(destination.pathname)) destination.pathname += '/';
      return new Response(null, { status: 301, headers: {
        Location: destination.href, 'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/form-config' && request.method === 'GET') {
        if (!configured(env)) return response(503, { code: 'unavailable' });
        return response(200, { siteKey: env.TURNSTILE_SITE_KEY });
      }
      if (url.pathname !== '/api/leads') return response(404, { code: 'not_found' });
      if (request.method !== 'POST') return response(405, { code: 'method' }, { Allow: 'POST' });
      return await submit(request, env, ctx);
    } catch (error) {
      if (error instanceof HttpError) return response(error.status, { code: error.code }, error.status === 429 ? { 'Retry-After': '60' } : {});
      console.error(JSON.stringify({ event: 'lead_api_error' }));
      return response(503, { code: 'unavailable' });
    }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(drainOutbox(env)); },
};
